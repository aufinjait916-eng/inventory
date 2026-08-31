import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import * as dotenv from 'dotenv';
import { Client } from 'pg';
import { db, pool } from './src/db/index.ts';
import {
  branches,
  departments,
  locations,
  machines,
  employees,
  employeeDepartments,
  categories,
  userCategoryPermissions,
  customFields,
  fieldSets,
  fieldSetItems,
  models,
  vendors,
  vendorBranchAssignments,
  requestReasons,
  inventoryItems,
  stockLocations,
  employeeRequests,
  inventoryMovements,
  vendorRepairs,
  entryLogs,
  users,
} from './src/db/schema.ts';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from './src/middleware/auth.ts';
import { seedDatabase } from './src/db/seed.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  // Initialize DB seed on startup (safe, skips if already populated)
  seedDatabase().catch((err) => console.error('Seed error:', err));

  // Helper function for entry logging
  async function logEntry(
    req: AuthRequest,
    action: string,
    entityType: string,
    entityId: string | number,
    details: string,
    branchId?: number | null
  ) {
    try {
      await db.insert(entryLogs).values({
        userId: req.user?.id || 1,
        userName: req.user?.name || 'System User',
        userRole: req.user?.role || 'admin',
        branchId: branchId ?? req.user?.branchId ?? 1,
        action,
        entityType,
        entityId: String(entityId),
        details,
      });
    } catch (err) {
      console.error('Failed to write entry log:', err);
    }
  }

  // Helper function to resolve category access permissions for the current user
  async function getPermittedCategoryIdsForUser(req: AuthRequest): Promise<number[] | null> {
    if (!req.user) return null;
    // Admins and Super Managers have full unrestricted visibility to all categories
    if (req.user.role === 'admin' || req.user.role === 'super_manager') {
      return null;
    }
    // Managers are strictly restricted to their assigned categories
    if (req.user.role === 'manager') {
      const userId = req.user.id;
      if (!userId) return [];
      const perms = await db.select().from(userCategoryPermissions).where(
        and(
          eq(userCategoryPermissions.userId, userId),
          eq(userCategoryPermissions.canManage, true)
        )
      );
      return perms.map(p => p.categoryId);
    }
    return null;
  }

  // ==========================================
  // API ROUTES
  // ==========================================

  // 1. Health & Current User Context
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/me', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const uRole = req.user?.role || 'admin';
      const uBranch = req.user?.branchId || 1;
      const uDept = req.user?.departmentId || 1;

      const [branchInfo] = uBranch ? await db.select().from(branches).where(eq(branches.id, uBranch)) : [null];
      const [deptInfo] = uDept ? await db.select().from(departments).where(eq(departments.id, uDept)) : [null];

      res.json({
        user: req.user,
        currentBranch: branchInfo,
        currentDepartment: deptInfo,
      });
    } catch (error: any) {
      console.error('Error in /api/me:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch user context' });
    }
  });

  // Reset/Seed demo data
  app.post('/api/seed-demo', authMiddleware, async (req: AuthRequest, res) => {
    try {
      await seedDatabase();
      await logEntry(req, 'SEED_DATABASE', 'system', 'SEED', 'Demo dataset seeded');
      res.json({ success: true, message: 'Database initialized with demo data' });
    } catch (error: any) {
      console.error('Error seeding database:', error);
      res.status(500).json({ error: error.message || 'Failed to seed database' });
    }
  });

  // 2. Branches
  app.get('/api/branches', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const allBranches = await db.select().from(branches).orderBy(branches.name);
      res.json(allBranches);
    } catch (error: any) {
      console.error('Error fetching branches:', error);
      res.status(500).json({ error: 'Failed to fetch branches' });
    }
  });

  app.post('/api/branches', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          error: 'Access Denied: Only System Administrators can create branches. Branch Managers and Super Managers do not have permission to add branches.'
        });
      }
      const { name, code, location, phone } = req.body;
      if (!name || !code || !location) {
        return res.status(400).json({ error: 'Name, code, and location are required' });
      }
      const [created] = await db.insert(branches).values({ name, code, location, phone }).returning();
      await logEntry(req, 'CREATE_BRANCH', 'branch', created.id, `Created branch ${name} (${code})`, created.id);
      res.json(created);
    } catch (error: any) {
      console.error('Error creating branch:', error);
      res.status(500).json({ error: error.message || 'Failed to create branch' });
    }
  });

  app.put('/api/branches/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          error: 'Access Denied: Only System Administrators can edit branch details.'
        });
      }
      const id = parseInt(req.params.id);
      const { name, code, location, phone } = req.body;
      const [updated] = await db.update(branches)
        .set({
          name: name || undefined,
          code: code || undefined,
          location: location || undefined,
          phone: phone !== undefined ? phone : undefined,
        })
        .where(eq(branches.id, id))
        .returning();
      await logEntry(req, 'UPDATE_BRANCH', 'branch', id, `Updated branch ${updated.name} (${updated.code})`, id);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating branch:', error);
      res.status(500).json({ error: error.message || 'Failed to update branch' });
    }
  });

  app.delete('/api/branches/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          error: 'Access Denied: Only System Administrators can delete branches.'
        });
      }
      const id = parseInt(req.params.id);
      await db.delete(branches).where(eq(branches.id, id));
      await logEntry(req, 'DELETE_BRANCH', 'branch', id, `Deleted branch #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting branch:', error);
      res.status(500).json({ error: error.message || 'Failed to delete branch' });
    }
  });

  // 3. Departments
  app.get('/api/departments', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.query;
      let query = db.select().from(departments);
      if (branchId) {
        const bId = parseInt(branchId as string);
        const results = await db.select().from(departments).where(eq(departments.branchId, bId)).orderBy(departments.name);
        return res.json(results);
      }
      const results = await query.orderBy(departments.name);
      res.json(results);
    } catch (error: any) {
      console.error('Error fetching departments:', error);
      res.status(500).json({ error: 'Failed to fetch departments' });
    }
  });

  app.post('/api/departments', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, name, code, floorLocation } = req.body;
      if (!branchId || !name || !code) {
        return res.status(400).json({ error: 'Branch, name, and code are required' });
      }
      const [created] = await db.insert(departments).values({
        branchId: parseInt(branchId),
        name,
        code,
        floorLocation,
      }).returning();
      await logEntry(req, 'CREATE_DEPARTMENT', 'department', created.id, `Created department ${name} in branch #${branchId}`, parseInt(branchId));
      res.json(created);
    } catch (error: any) {
      console.error('Error creating department:', error);
      res.status(500).json({ error: error.message || 'Failed to create department' });
    }
  });

  app.put('/api/departments/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { branchId, name, code, floorLocation } = req.body;
      const [updated] = await db.update(departments)
        .set({
          branchId: branchId ? parseInt(branchId) : undefined,
          name: name || undefined,
          code: code || undefined,
          floorLocation: floorLocation !== undefined ? floorLocation : undefined,
        })
        .where(eq(departments.id, id))
        .returning();
      await logEntry(req, 'UPDATE_DEPARTMENT', 'department', id, `Updated department ${updated.name}`);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating department:', error);
      res.status(500).json({ error: error.message || 'Failed to update department' });
    }
  });

  app.delete('/api/departments/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(employeeDepartments).where(eq(employeeDepartments.departmentId, id));
      await db.delete(departments).where(eq(departments.id, id));
      await logEntry(req, 'DELETE_DEPARTMENT', 'department', id, `Deleted department #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting department:', error);
      res.status(500).json({ error: error.message || 'Failed to delete department' });
    }
  });

  // 4. Locations & Sublocations
  app.get('/api/locations', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, departmentId } = req.query;
      let conditions = [];
      if (branchId) conditions.push(eq(locations.branchId, parseInt(branchId as string)));
      if (departmentId) conditions.push(eq(locations.departmentId, parseInt(departmentId as string)));

      const results = conditions.length > 0
        ? await db.select().from(locations).where(and(...conditions)).orderBy(locations.name)
        : await db.select().from(locations).orderBy(locations.name);

      const locMap = new Map(results.map(l => [l.id, l]));
      const enriched = results.map(l => ({
        ...l,
        parentLocation: l.parentLocationId ? locMap.get(l.parentLocationId) || null : null,
        sublocations: results.filter(sub => sub.parentLocationId === l.id),
      }));

      res.json(enriched);
    } catch (error: any) {
      console.error('Error fetching locations:', error);
      res.status(500).json({ error: 'Failed to fetch locations' });
    }
  });

  app.post('/api/locations', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, departmentId, name, type, parentLocationId } = req.body;
      if (!branchId || !name) {
        return res.status(400).json({ error: 'Branch and name are required' });
      }

      const targetBranchId = parseInt(branchId);
      const userRole = req.user?.role || 'admin';
      const userBranchId = req.user?.branchId;

      // Branch manager can only create locations in the branch he is associated with
      if (userRole === 'manager' && userBranchId && targetBranchId !== userBranchId) {
        return res.status(403).json({ error: 'Branch Managers can only create locations in their associated branch.' });
      }

      let finalBranchId = targetBranchId;
      let finalDepartmentId = departmentId ? parseInt(departmentId) : null;
      const parsedParentId = parentLocationId ? parseInt(parentLocationId) : null;

      // When creating sublocation then department will be fixed based on the selected parent location
      if (parsedParentId) {
        const [parentLoc] = await db.select().from(locations).where(eq(locations.id, parsedParentId));
        if (parentLoc) {
          finalBranchId = parentLoc.branchId;
          finalDepartmentId = parentLoc.departmentId || null;
        }
      }

      const [created] = await db.insert(locations).values({
        branchId: finalBranchId,
        departmentId: finalDepartmentId,
        name,
        type: type || 'storage',
        parentLocationId: parsedParentId,
      }).returning();
      await logEntry(req, 'CREATE_LOCATION', 'location', created.id, `Created storage location ${name}`, finalBranchId);
      res.json(created);
    } catch (error: any) {
      console.error('Error creating location:', error);
      res.status(500).json({ error: error.message || 'Failed to create location' });
    }
  });

  app.put('/api/locations/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { branchId, departmentId, name, type, parentLocationId } = req.body;

      const targetBranchId = branchId ? parseInt(branchId) : undefined;
      const userRole = req.user?.role || 'admin';
      const userBranchId = req.user?.branchId;

      if (userRole === 'manager' && userBranchId && targetBranchId && targetBranchId !== userBranchId) {
        return res.status(403).json({ error: 'Branch Managers can only update locations in their associated branch.' });
      }

      let finalDepartmentId = departmentId !== undefined ? (departmentId ? parseInt(departmentId) : null) : undefined;
      const parsedParentId = parentLocationId !== undefined ? (parentLocationId ? parseInt(parentLocationId) : null) : undefined;

      if (parsedParentId) {
        const [parentLoc] = await db.select().from(locations).where(eq(locations.id, parsedParentId));
        if (parentLoc) {
          finalDepartmentId = parentLoc.departmentId || null;
        }
      }

      const [updated] = await db.update(locations)
        .set({
          branchId: targetBranchId,
          departmentId: finalDepartmentId,
          name: name || undefined,
          type: type || undefined,
          parentLocationId: parsedParentId,
        })
        .where(eq(locations.id, id))
        .returning();
      await logEntry(req, 'UPDATE_LOCATION', 'location', id, `Updated location ${updated.name}`);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating location:', error);
      res.status(500).json({ error: error.message || 'Failed to update location' });
    }
  });

  app.delete('/api/locations/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(locations).where(eq(locations.id, id));
      await logEntry(req, 'DELETE_LOCATION', 'location', id, `Deleted location #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting location:', error);
      res.status(500).json({ error: error.message || 'Failed to delete location' });
    }
  });

  // 5. Machines
  app.get('/api/machines', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, departmentId } = req.query;
      let conditions = [];
      if (branchId) conditions.push(eq(machines.branchId, parseInt(branchId as string)));
      if (departmentId) conditions.push(eq(machines.departmentId, parseInt(departmentId as string)));

      const results = conditions.length > 0
        ? await db.select().from(machines).where(and(...conditions)).orderBy(machines.name)
        : await db.select().from(machines).orderBy(machines.name);

      res.json(results);
    } catch (error: any) {
      console.error('Error fetching machines:', error);
      res.status(500).json({ error: 'Failed to fetch machines' });
    }
  });

  app.post('/api/machines', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, departmentId, name, machineCode, model, status } = req.body;
      if (!branchId || !departmentId || !name || !machineCode) {
        return res.status(400).json({ error: 'Branch, department, name, and machine code are required' });
      }
      const [created] = await db.insert(machines).values({
        branchId: parseInt(branchId),
        departmentId: parseInt(departmentId),
        name,
        machineCode,
        model,
        status: status || 'active',
      }).returning();
      await logEntry(req, 'CREATE_MACHINE', 'machine', created.id, `Created machine ${name} (${machineCode})`, parseInt(branchId));
      res.json(created);
    } catch (error: any) {
      console.error('Error creating machine:', error);
      res.status(500).json({ error: error.message || 'Failed to create machine' });
    }
  });

  app.put('/api/machines/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { branchId, departmentId, name, machineCode, model, status } = req.body;
      const [updated] = await db.update(machines)
        .set({
          branchId: branchId ? parseInt(branchId) : undefined,
          departmentId: departmentId ? parseInt(departmentId) : undefined,
          name: name || undefined,
          machineCode: machineCode || undefined,
          model: model !== undefined ? model : undefined,
          status: status || undefined,
        })
        .where(eq(machines.id, id))
        .returning();
      await logEntry(req, 'UPDATE_MACHINE', 'machine', id, `Updated machine ${updated.name} (${updated.machineCode})`);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating machine:', error);
      res.status(500).json({ error: error.message || 'Failed to update machine' });
    }
  });

  app.delete('/api/machines/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(machines).where(eq(machines.id, id));
      await logEntry(req, 'DELETE_MACHINE', 'machine', id, `Deleted machine #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting machine:', error);
      res.status(500).json({ error: error.message || 'Failed to delete machine' });
    }
  });

  // 6. Employees & Department Associations
  app.get('/api/employees', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.query;
      let conditions = [];
      if (branchId) conditions.push(eq(employees.branchId, parseInt(branchId as string)));

      const empList = conditions.length > 0
        ? await db.select().from(employees).where(and(...conditions)).orderBy(employees.name)
        : await db.select().from(employees).orderBy(employees.name);

      // Fetch department links
      const allLinks = await db.select().from(employeeDepartments);
      const allDepts = await db.select().from(departments);
      const deptMap = new Map(allDepts.map(d => [d.id, d]));

      const enriched = empList.map(emp => {
        const depts = allLinks
          .filter(l => l.employeeId === emp.id)
          .map(l => ({
            ...l,
            department: deptMap.get(l.departmentId),
          }));
        return { ...emp, departments: depts };
      });

      res.json(enriched);
    } catch (error: any) {
      console.error('Error fetching employees:', error);
      res.status(500).json({ error: 'Failed to fetch employees' });
    }
  });

  app.post('/api/employees', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { name, employeeCode, branchId, userCode, phone, email, departmentIds, primaryDepartmentId } = req.body;
      if (!name || !employeeCode || !branchId || !userCode) {
        return res.status(400).json({ error: 'Name, employee code, branch, and 4-digit user code are required' });
      }
      if (userCode.length !== 4 || !/^\d{4}$/.test(userCode)) {
        return res.status(400).json({ error: 'Security user code must be a 4-digit numeric string' });
      }

      const [created] = await db.insert(employees).values({
        name,
        employeeCode,
        branchId: parseInt(branchId),
        userCode,
        phone,
        email,
      }).returning();

      if (departmentIds && Array.isArray(departmentIds) && departmentIds.length > 0) {
        const links = departmentIds.map((dId: number) => ({
          employeeId: created.id,
          departmentId: dId,
          isPrimary: primaryDepartmentId ? dId === primaryDepartmentId : false,
        }));
        await db.insert(employeeDepartments).values(links);
      }

      await logEntry(req, 'CREATE_EMPLOYEE', 'employee', created.id, `Created employee ${name} with 4-digit code [${userCode}]`, parseInt(branchId));
      res.json(created);
    } catch (error: any) {
      console.error('Error creating employee:', error);
      res.status(500).json({ error: error.message || 'Failed to create employee' });
    }
  });

  app.put('/api/employees/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, employeeCode, branchId, userCode, phone, email, isActive, departmentIds, primaryDepartmentId } = req.body;

      if (userCode && (userCode.length !== 4 || !/^\d{4}$/.test(userCode))) {
        return res.status(400).json({ error: 'Security user code must be a 4-digit numeric string' });
      }

      const [updated] = await db.update(employees)
        .set({
          name: name || undefined,
          employeeCode: employeeCode || undefined,
          branchId: branchId ? parseInt(branchId) : undefined,
          userCode: userCode || undefined,
          phone: phone !== undefined ? phone : undefined,
          email: email !== undefined ? email : undefined,
          isActive: isActive !== undefined ? !!isActive : undefined,
        })
        .where(eq(employees.id, id))
        .returning();

      if (departmentIds && Array.isArray(departmentIds)) {
        await db.delete(employeeDepartments).where(eq(employeeDepartments.employeeId, id));
        if (departmentIds.length > 0) {
          const links = departmentIds.map((dId: number) => ({
            employeeId: id,
            departmentId: dId,
            isPrimary: primaryDepartmentId ? dId === primaryDepartmentId : false,
          }));
          await db.insert(employeeDepartments).values(links);
        }
      }

      await logEntry(req, 'UPDATE_EMPLOYEE', 'employee', id, `Updated employee ${updated.name} (${updated.employeeCode})`);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating employee:', error);
      res.status(500).json({ error: error.message || 'Failed to update employee' });
    }
  });

  app.delete('/api/employees/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(employeeDepartments).where(eq(employeeDepartments.employeeId, id));
      await db.delete(employees).where(eq(employees.id, id));
      await logEntry(req, 'DELETE_EMPLOYEE', 'employee', id, `Deleted employee #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      res.status(500).json({ error: error.message || 'Failed to delete employee' });
    }
  });

  // Employee 4-digit security code validation (for Department / Employee Punch Portal)
  app.post('/api/employee-punch-verify', async (req, res) => {
    try {
      const { userCode, departmentId, branchId } = req.body;
      if (!userCode || userCode.length !== 4) {
        return res.status(400).json({ error: 'Please enter a valid 4-digit numeric code' });
      }

      const [matchedEmp] = await db.select().from(employees).where(
        and(
          eq(employees.userCode, userCode),
          eq(employees.isActive, true)
        )
      );

      if (!matchedEmp) {
        return res.status(401).json({ error: 'Invalid 4-digit security code. Employee not found.' });
      }

      // Check if employee belongs to this department
      if (departmentId) {
        const links = await db.select().from(employeeDepartments).where(
          and(
            eq(employeeDepartments.employeeId, matchedEmp.id),
            eq(employeeDepartments.departmentId, parseInt(departmentId))
          )
        );
        if (links.length === 0) {
          return res.status(403).json({
            error: `Employee ${matchedEmp.name} is not assigned to this department.`,
          });
        }
      }

      res.json({
        success: true,
        employee: {
          id: matchedEmp.id,
          name: matchedEmp.name,
          employeeCode: matchedEmp.employeeCode,
          branchId: matchedEmp.branchId,
        },
      });
    } catch (error: any) {
      console.error('Error verifying employee punch code:', error);
      res.status(500).json({ error: 'Failed to verify employee code' });
    }
  });

  // 6b. System Users & Managers Management (Admin only for creation & modifications)
  app.get('/api/users', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, role } = req.query;
      let userList = await db.select().from(users).orderBy(users.name);
      if (branchId) {
        userList = userList.filter(u => u.branchId === parseInt(branchId as string));
      }
      if (role) {
        userList = userList.filter(u => u.role === role);
      }
      const allBranches = await db.select().from(branches);
      const bMap = new Map(allBranches.map(b => [b.id, b]));
      const allDepts = await db.select().from(departments);
      const dMap = new Map(allDepts.map(d => [d.id, d]));
      const allPerms = await db.select().from(userCategoryPermissions);
      const allCats = await db.select().from(categories);
      const catMap = new Map(allCats.map(c => [c.id, c]));

      const enriched = userList.map(u => {
        const userPerms = allPerms.filter(p => p.userId === u.id && p.canManage);
        const catIds = userPerms.map(p => p.categoryId);
        const assignedCats = catIds.map(cId => catMap.get(cId)).filter(Boolean);
        return {
          ...u,
          branch: u.branchId ? bMap.get(u.branchId) : null,
          department: u.departmentId ? dMap.get(u.departmentId) : null,
          assignedCategoryIds: catIds,
          assignedCategories: assignedCats,
        };
      });
      res.json(enriched);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.post('/api/users', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Permission Denied: Only System Administrators can add managers and users.' });
      }
      const { name, email, role, branchId, departmentId, userCode, isActive, assignedCategoryIds } = req.body;
      if (!name || !email || !role) {
        return res.status(400).json({ error: 'Name, email, and role are required' });
      }

      const uid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const [created] = await db.insert(users).values({
        uid,
        name,
        email,
        role: role || 'manager',
        branchId: branchId ? parseInt(branchId) : null,
        departmentId: departmentId ? parseInt(departmentId) : null,
        userCode: userCode || null,
        isActive: isActive !== undefined ? !!isActive : true,
      }).returning();

      // If category IDs provided, assign them
      if (Array.isArray(assignedCategoryIds) && assignedCategoryIds.length > 0) {
        const rows = assignedCategoryIds.map((cId: any) => ({
          userId: created.id,
          categoryId: parseInt(cId),
          canManage: true,
        }));
        await db.insert(userCategoryPermissions).values(rows);
      }

      await logEntry(req, 'CREATE_USER', 'user', created.id, `Created ${role} user ${name} (${email}) associated with branch #${branchId || 'All'}`, branchId ? parseInt(branchId) : 1);
      res.json(created);
    } catch (error: any) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: error.message || 'Failed to create user' });
    }
  });

  app.put('/api/users/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Permission Denied: Only System Administrators can edit managers and users.' });
      }
      const id = parseInt(req.params.id);
      const { name, email, role, branchId, departmentId, userCode, isActive, assignedCategoryIds } = req.body;
      const [updated] = await db.update(users)
        .set({
          name: name || undefined,
          email: email || undefined,
          role: role || undefined,
          branchId: branchId !== undefined ? (branchId ? parseInt(branchId) : null) : undefined,
          departmentId: departmentId !== undefined ? (departmentId ? parseInt(departmentId) : null) : undefined,
          userCode: userCode !== undefined ? userCode : undefined,
          isActive: isActive !== undefined ? !!isActive : undefined,
        })
        .where(eq(users.id, id))
        .returning();

      if (Array.isArray(assignedCategoryIds)) {
        await db.delete(userCategoryPermissions).where(eq(userCategoryPermissions.userId, id));
        if (assignedCategoryIds.length > 0) {
          const rows = assignedCategoryIds.map((cId: any) => ({
            userId: id,
            categoryId: parseInt(cId),
            canManage: true,
          }));
          await db.insert(userCategoryPermissions).values(rows);
        }
      }

      await logEntry(req, 'UPDATE_USER', 'user', id, `Updated manager/user ${updated.name} (${updated.role})`);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: error.message || 'Failed to update user' });
    }
  });

  // Assign categories to a manager user
  app.put('/api/users/:id/categories', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'super_manager') {
        return res.status(403).json({ error: 'Access Denied: Only Administrators can assign categories to managers.' });
      }
      const userId = parseInt(req.params.id);
      const { categoryIds } = req.body;
      if (!Array.isArray(categoryIds)) {
        return res.status(400).json({ error: 'categoryIds array is required' });
      }

      const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Delete existing permissions for this user
      await db.delete(userCategoryPermissions).where(eq(userCategoryPermissions.userId, userId));

      // Insert new permissions
      if (categoryIds.length > 0) {
        const rows = categoryIds.map((cId: any) => ({
          userId,
          categoryId: parseInt(cId),
          canManage: true,
        }));
        await db.insert(userCategoryPermissions).values(rows);
      }

      await logEntry(
        req,
        'ASSIGN_CATEGORIES',
        'user',
        userId,
        `Assigned ${categoryIds.length} categories to Manager ${targetUser.name} (${targetUser.email})`,
        targetUser.branchId || undefined
      );

      const allCats = await db.select().from(categories);
      const catMap = new Map(allCats.map(c => [c.id, c]));
      const assignedCats = categoryIds.map((cId: any) => catMap.get(parseInt(cId))).filter(Boolean);

      res.json({
        success: true,
        userId,
        assignedCategoryIds: categoryIds.map((c: any) => parseInt(c)),
        assignedCategories: assignedCats,
      });
    } catch (error: any) {
      console.error('Error assigning categories to user:', error);
      res.status(500).json({ error: error.message || 'Failed to assign categories' });
    }
  });

  app.delete('/api/users/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Permission Denied: Only System Administrators can delete managers and users.' });
      }
      const id = parseInt(req.params.id);
      await db.delete(userCategoryPermissions).where(eq(userCategoryPermissions.userId, id));
      await db.delete(users).where(eq(users.id, id));
      await logEntry(req, 'DELETE_USER', 'user', id, `Deleted user #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: error.message || 'Failed to delete user' });
    }
  });

  // 7. Categories & Permissions
  app.get('/api/categories', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { type, all } = req.query;
      const allowedCatIds = all === 'true' ? null : await getPermittedCategoryIdsForUser(req);

      let results = await db.select().from(categories).orderBy(categories.name);

      if (type) {
        results = results.filter(c => c.type === type);
      }

      if (allowedCatIds !== null) {
        results = results.filter(c => allowedCatIds.includes(c.id));
      }

      res.json(results);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  app.post('/api/categories', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { name, code, type, description } = req.body;
      if (!name || !code || !type) {
        return res.status(400).json({ error: 'Name, code, and type (asset/consumable) are required' });
      }
      const [created] = await db.insert(categories).values({
        name,
        code,
        type,
        description,
      }).returning();
      await logEntry(req, 'CREATE_CATEGORY', 'category', created.id, `Created ${type} category: ${name}`);
      res.json(created);
    } catch (error: any) {
      console.error('Error creating category:', error);
      res.status(500).json({ error: error.message || 'Failed to create category' });
    }
  });

  app.put('/api/categories/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, code, type, description } = req.body;
      const [updated] = await db.update(categories)
        .set({
          name: name || undefined,
          code: code || undefined,
          type: type || undefined,
          description: description !== undefined ? description : undefined,
        })
        .where(eq(categories.id, id))
        .returning();
      await logEntry(req, 'UPDATE_CATEGORY', 'category', id, `Updated category ${updated.name}`);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating category:', error);
      res.status(500).json({ error: error.message || 'Failed to update category' });
    }
  });

  app.delete('/api/categories/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(userCategoryPermissions).where(eq(userCategoryPermissions.categoryId, id));
      await db.delete(categories).where(eq(categories.id, id));
      await logEntry(req, 'DELETE_CATEGORY', 'category', id, `Deleted category #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting category:', error);
      res.status(500).json({ error: error.message || 'Failed to delete category' });
    }
  });

  // Category Permissions
  app.get('/api/category-permissions', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const allPerms = await db.select().from(userCategoryPermissions);
      res.json(allPerms);
    } catch (error: any) {
      console.error('Error fetching category permissions:', error);
      res.status(500).json({ error: 'Failed to fetch category permissions' });
    }
  });

  app.post('/api/category-permissions', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { userId, categoryId, canManage } = req.body;
      if (!userId || !categoryId) {
        return res.status(400).json({ error: 'User and Category are required' });
      }

      const existing = await db.select().from(userCategoryPermissions).where(
        and(
          eq(userCategoryPermissions.userId, parseInt(userId)),
          eq(userCategoryPermissions.categoryId, parseInt(categoryId))
        )
      );

      if (existing.length > 0) {
        const [updated] = await db.update(userCategoryPermissions)
          .set({ canManage: !!canManage })
          .where(eq(userCategoryPermissions.id, existing[0].id))
          .returning();
        return res.json(updated);
      } else {
        const [created] = await db.insert(userCategoryPermissions).values({
          userId: parseInt(userId),
          categoryId: parseInt(categoryId),
          canManage: !!canManage,
        }).returning();
        await logEntry(req, 'ASSIGN_CATEGORY_PERMISSION', 'permission', created.id, `Assigned category #${categoryId} to user #${userId}`);
        return res.json(created);
      }
    } catch (error: any) {
      console.error('Error updating category permissions:', error);
      res.status(500).json({ error: error.message || 'Failed to update category permission' });
    }
  });

  // 8. Custom Fields & Field Sets
  app.get('/api/custom-fields', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { categoryId, all } = req.query;
      const allowedCatIds = all === 'true' ? null : await getPermittedCategoryIdsForUser(req);

      let results = categoryId
        ? await db.select().from(customFields).where(eq(customFields.categoryId, parseInt(categoryId as string))).orderBy(customFields.name)
        : await db.select().from(customFields).orderBy(customFields.name);

      if (allowedCatIds !== null) {
        results = results.filter(cf => allowedCatIds.includes(cf.categoryId));
      }

      res.json(results);
    } catch (error: any) {
      console.error('Error fetching custom fields:', error);
      res.status(500).json({ error: 'Failed to fetch custom fields' });
    }
  });

  app.post('/api/custom-fields', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { categoryId, name, label, fieldType, options, isRequired, defaultValue } = req.body;
      if (!categoryId || !name || !label || !fieldType) {
        return res.status(400).json({ error: 'Category, name, label, and fieldType are required' });
      }

      const [created] = await db.insert(customFields).values({
        categoryId: parseInt(categoryId),
        name,
        label,
        fieldType,
        options: options || null,
        isRequired: !!isRequired,
        defaultValue: defaultValue || null,
      }).returning();
      await logEntry(req, 'CREATE_CUSTOM_FIELD', 'custom_field', created.id, `Created custom field ${label} under category #${categoryId}`);
      res.json(created);
    } catch (error: any) {
      console.error('Error creating custom field:', error);
      res.status(500).json({ error: error.message || 'Failed to create custom field' });
    }
  });

  app.put('/api/custom-fields/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { categoryId, name, label, fieldType, options, isRequired, defaultValue } = req.body;
      const [updated] = await db.update(customFields)
        .set({
          categoryId: categoryId ? parseInt(categoryId) : undefined,
          name: name || undefined,
          label: label || undefined,
          fieldType: fieldType || undefined,
          options: options !== undefined ? options : undefined,
          isRequired: isRequired !== undefined ? !!isRequired : undefined,
          defaultValue: defaultValue !== undefined ? defaultValue : undefined,
        })
        .where(eq(customFields.id, id))
        .returning();
      await logEntry(req, 'UPDATE_CUSTOM_FIELD', 'custom_field', id, `Updated custom field ${updated.label}`);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating custom field:', error);
      res.status(500).json({ error: error.message || 'Failed to update custom field' });
    }
  });

  app.delete('/api/custom-fields/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(fieldSetItems).where(eq(fieldSetItems.customFieldId, id));
      await db.delete(customFields).where(eq(customFields.id, id));
      await logEntry(req, 'DELETE_CUSTOM_FIELD', 'custom_field', id, `Deleted custom field #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting custom field:', error);
      res.status(500).json({ error: error.message || 'Failed to delete custom field' });
    }
  });

  app.get('/api/field-sets', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { categoryId, all } = req.query;
      const allowedCatIds = all === 'true' ? null : await getPermittedCategoryIdsForUser(req);

      let fsList = categoryId
        ? await db.select().from(fieldSets).where(eq(fieldSets.categoryId, parseInt(categoryId as string))).orderBy(fieldSets.name)
        : await db.select().from(fieldSets).orderBy(fieldSets.name);

      if (allowedCatIds !== null) {
        fsList = fsList.filter(fs => allowedCatIds.includes(fs.categoryId));
      }

      const allItems = await db.select().from(fieldSetItems).orderBy(fieldSetItems.displayOrder);
      const allFields = await db.select().from(customFields);
      const fieldMap = new Map(allFields.map(f => [f.id, f]));

      const enriched = fsList.map(fs => {
        const fields = allItems
          .filter(i => i.fieldSetId === fs.id)
          .map(i => fieldMap.get(i.customFieldId))
          .filter(Boolean);
        return { ...fs, fields };
      });

      res.json(enriched);
    } catch (error: any) {
      console.error('Error fetching field sets:', error);
      res.status(500).json({ error: 'Failed to fetch field sets' });
    }
  });

  app.post('/api/field-sets', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { categoryId, name, description, customFieldIds, fieldIds, fields } = req.body;
      if (!categoryId || !name) {
        return res.status(400).json({ error: 'Category and name are required' });
      }

      const [created] = await db.insert(fieldSets).values({
        categoryId: parseInt(categoryId),
        name,
        description: description || null,
      }).returning();

      const rawFieldIds = customFieldIds || fieldIds || fields || [];
      const fieldIdsList: number[] = Array.isArray(rawFieldIds)
        ? rawFieldIds
            .map((f: any) => (typeof f === 'object' && f !== null ? (f.customFieldId || f.id) : f))
            .filter((id: any) => typeof id === 'number' && !isNaN(id))
        : [];

      if (fieldIdsList.length > 0) {
        const items = fieldIdsList.map((cId: number, idx: number) => ({
          fieldSetId: created.id,
          customFieldId: cId,
          displayOrder: idx + 1,
        }));
        await db.insert(fieldSetItems).values(items);
      }

      await logEntry(req, 'CREATE_FIELD_SET', 'field_set', created.id, `Created field set ${name} with ${fieldIdsList.length} fields`);
      
      // Return enriched field set
      const allFields = await db.select().from(customFields);
      const fieldMap = new Map(allFields.map(f => [f.id, f]));
      const linkedFields = fieldIdsList.map(id => fieldMap.get(id)).filter(Boolean);

      res.json({ ...created, fields: linkedFields });
    } catch (error: any) {
      console.error('Error creating field set:', error);
      res.status(500).json({ error: error.message || 'Failed to create field set' });
    }
  });

  app.put('/api/field-sets/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { categoryId, name, description, customFieldIds, fieldIds, fields } = req.body;

      const [updated] = await db.update(fieldSets)
        .set({
          categoryId: categoryId ? parseInt(categoryId) : undefined,
          name: name || undefined,
          description: description !== undefined ? description : undefined,
        })
        .where(eq(fieldSets.id, id))
        .returning();

      const rawFieldIds = customFieldIds || fieldIds || fields;
      if (rawFieldIds && Array.isArray(rawFieldIds)) {
        await db.delete(fieldSetItems).where(eq(fieldSetItems.fieldSetId, id));
        const fieldIdsList: number[] = rawFieldIds
          .map((f: any) => (typeof f === 'object' && f !== null ? (f.customFieldId || f.id) : f))
          .filter((fId: any) => typeof fId === 'number' && !isNaN(fId));

        if (fieldIdsList.length > 0) {
          const items = fieldIdsList.map((cId: number, idx: number) => ({
            fieldSetId: id,
            customFieldId: cId,
            displayOrder: idx + 1,
          }));
          await db.insert(fieldSetItems).values(items);
        }
      }

      await logEntry(req, 'UPDATE_FIELD_SET', 'field_set', id, `Updated field set #${id} (${updated.name})`);

      const allItems = await db.select().from(fieldSetItems).where(eq(fieldSetItems.fieldSetId, id)).orderBy(fieldSetItems.displayOrder);
      const allFields = await db.select().from(customFields);
      const fieldMap = new Map(allFields.map(f => [f.id, f]));
      const enrichedFields = allItems.map(i => fieldMap.get(i.customFieldId)).filter(Boolean);

      res.json({ ...updated, fields: enrichedFields });
    } catch (error: any) {
      console.error('Error updating field set:', error);
      res.status(500).json({ error: error.message || 'Failed to update field set' });
    }
  });

  app.delete('/api/field-sets/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(fieldSetItems).where(eq(fieldSetItems.fieldSetId, id));
      await db.delete(fieldSets).where(eq(fieldSets.id, id));
      await logEntry(req, 'DELETE_FIELD_SET', 'field_set', id, `Deleted field set #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting field set:', error);
      res.status(500).json({ error: error.message || 'Failed to delete field set' });
    }
  });

  // 9. Models
  app.get('/api/models', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { categoryId, all } = req.query;
      const allowedCatIds = all === 'true' ? null : await getPermittedCategoryIdsForUser(req);

      let modelList = categoryId
        ? await db.select().from(models).where(eq(models.categoryId, parseInt(categoryId as string))).orderBy(models.name)
        : await db.select().from(models).orderBy(models.name);

      if (allowedCatIds !== null) {
        modelList = modelList.filter(m => allowedCatIds.includes(m.categoryId));
      }

      const allFieldSets = await db.select().from(fieldSets);
      const allItems = await db.select().from(fieldSetItems).orderBy(fieldSetItems.displayOrder);
      const allFields = await db.select().from(customFields);
      const fieldMap = new Map(allFields.map(f => [f.id, f]));

      const enrichedFieldSets = allFieldSets.map(fs => {
        const fields = allItems
          .filter(i => i.fieldSetId === fs.id)
          .map(i => fieldMap.get(i.customFieldId))
          .filter(Boolean);
        return { ...fs, fields };
      });

      const fsMap = new Map(enrichedFieldSets.map(f => [f.id, f]));

      const allCategories = await db.select().from(categories);
      const catMap = new Map(allCategories.map(c => [c.id, c]));

      const enriched = modelList.map(m => ({
        ...m,
        fieldSet: m.fieldSetId ? fsMap.get(m.fieldSetId) : null,
        category: catMap.get(m.categoryId),
      }));

      res.json(enriched);
    } catch (error: any) {
      console.error('Error fetching models:', error);
      res.status(500).json({ error: 'Failed to fetch models' });
    }
  });

  app.post('/api/models', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { categoryId, fieldSetId, name, modelNumber, manufacturer, description } = req.body;
      if (!categoryId || !name || !modelNumber) {
        return res.status(400).json({ error: 'Category, name, and model number are required' });
      }

      const [created] = await db.insert(models).values({
        categoryId: parseInt(categoryId),
        fieldSetId: fieldSetId ? parseInt(fieldSetId) : null,
        name,
        modelNumber,
        manufacturer: manufacturer || null,
        description: description || null,
      }).returning();

      await logEntry(req, 'CREATE_MODEL', 'model', created.id, `Created model ${name} (${modelNumber}) under category #${categoryId}`);
      res.json(created);
    } catch (error: any) {
      console.error('Error creating model:', error);
      res.status(500).json({ error: error.message || 'Failed to create model' });
    }
  });

  app.put('/api/models/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { categoryId, fieldSetId, name, modelNumber, manufacturer, description } = req.body;
      const [updated] = await db.update(models)
        .set({
          categoryId: categoryId ? parseInt(categoryId) : undefined,
          fieldSetId: fieldSetId !== undefined ? (fieldSetId ? parseInt(fieldSetId) : null) : undefined,
          name: name || undefined,
          modelNumber: modelNumber || undefined,
          manufacturer: manufacturer !== undefined ? manufacturer : undefined,
          description: description !== undefined ? description : undefined,
        })
        .where(eq(models.id, id))
        .returning();
      await logEntry(req, 'UPDATE_MODEL', 'model', id, `Updated model ${updated.name} (${updated.modelNumber})`);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating model:', error);
      res.status(500).json({ error: error.message || 'Failed to update model' });
    }
  });

  app.delete('/api/models/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(models).where(eq(models.id, id));
      await logEntry(req, 'DELETE_MODEL', 'model', id, `Deleted model #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting model:', error);
      res.status(500).json({ error: error.message || 'Failed to delete model' });
    }
  });

  // 10. Vendors / Suppliers & Repairs (With Branch Ownership & Multi-Branch Visibility Assignments)
  app.get('/api/vendors', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, all } = req.query;
      const allVendors = await db.select().from(vendors).orderBy(vendors.name);
      const allAssignments = await db.select().from(vendorBranchAssignments);
      const allBranches = await db.select().from(branches);
      const branchMap = new Map(allBranches.map(b => [b.id, b]));

      const userRole = req.user?.role || 'admin';
      const userBranch = req.user?.branchId || (branchId ? parseInt(branchId as string) : null);

      const enriched = allVendors.map(v => {
        const assignedIds = allAssignments
          .filter(a => a.vendorId === v.id)
          .map(a => a.branchId);

        return {
          ...v,
          originBranch: v.branchId ? branchMap.get(v.branchId) || null : null,
          assignedBranchIds: assignedIds,
          assignedBranches: assignedIds.map(bId => branchMap.get(bId)).filter(Boolean),
        };
      });

      // Admin & Super Manager can see all vendors
      if (userRole === 'admin' || userRole === 'super_manager' || all === 'true') {
        return res.json(enriched);
      }

      // Branch Manager or Department: can only see vendors created at their branch OR assigned by Admin
      const filtered = enriched.filter(v => {
        if (!userBranch) return true;
        const isOrigin = v.branchId === userBranch;
        const isAssigned = v.assignedBranchIds.includes(userBranch);
        return isOrigin || isAssigned;
      });

      res.json(filtered);
    } catch (error: any) {
      console.error('Error fetching vendors:', error);
      res.status(500).json({ error: 'Failed to fetch vendors' });
    }
  });

  app.post('/api/vendors', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, name, contactPerson, email, phone, address, serviceType, assignedBranchIds } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Vendor name is required' });
      }

      const originatingBranchId = branchId ? parseInt(branchId) : (req.user?.branchId || 1);

      const [created] = await db.insert(vendors).values({
        branchId: originatingBranchId,
        name,
        contactPerson,
        email,
        phone,
        address,
        serviceType: serviceType || 'supplier_and_repair',
      }).returning();

      if (assignedBranchIds && Array.isArray(assignedBranchIds) && assignedBranchIds.length > 0) {
        const rows = assignedBranchIds
          .map((bId: any) => parseInt(bId))
          .filter((bId: number) => !isNaN(bId) && bId !== originatingBranchId)
          .map((bId: number) => ({
            vendorId: created.id,
            branchId: bId,
            grantedByUserId: req.user?.id || 1,
          }));
        if (rows.length > 0) {
          await db.insert(vendorBranchAssignments).values(rows);
        }
      }

      await logEntry(req, 'CREATE_VENDOR', 'vendor', created.id, `Created vendor ${name} at Branch #${originatingBranchId}`, originatingBranchId);
      res.json(created);
    } catch (error: any) {
      console.error('Error creating vendor:', error);
      res.status(500).json({ error: error.message || 'Failed to create vendor' });
    }
  });

  // Assign vendor visibility to branch managers (Admin only)
  app.post('/api/vendors/:id/branch-assignments', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'super_manager') {
        return res.status(403).json({ error: 'Access Denied: Only Administrators can configure vendor branch permissions.' });
      }

      const vendorId = parseInt(req.params.id);
      const { branchIds } = req.body;

      const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId));
      if (!vendor) {
        return res.status(404).json({ error: 'Vendor record not found' });
      }

      // Delete existing assignments for this vendor
      await db.delete(vendorBranchAssignments).where(eq(vendorBranchAssignments.vendorId, vendorId));

      // Insert new assigned branches
      if (Array.isArray(branchIds) && branchIds.length > 0) {
        const validIds = branchIds
          .map((bId: any) => parseInt(bId))
          .filter((bId: number) => !isNaN(bId) && bId !== vendor.branchId);

        if (validIds.length > 0) {
          const rows = validIds.map((bId: number) => ({
            vendorId,
            branchId: bId,
            grantedByUserId: req.user?.id || 1,
          }));
          await db.insert(vendorBranchAssignments).values(rows);
        }
      }

      await logEntry(
        req,
        'ASSIGN_VENDOR_BRANCHES',
        'vendor',
        vendorId,
        `Admin updated branch visibility for vendor "${vendor.name}". Visible to branch IDs: [${(branchIds || []).join(', ')}]`,
        vendor.branchId || undefined
      );

      res.json({ success: true, vendorId, assignedBranchIds: branchIds || [] });
    } catch (error: any) {
      console.error('Error updating vendor branch assignments:', error);
      res.status(500).json({ error: error.message || 'Failed to update vendor branch visibility' });
    }
  });

  app.put('/api/vendors/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { branchId, name, contactPerson, email, phone, address, serviceType, assignedBranchIds } = req.body;
      const [updated] = await db.update(vendors)
        .set({
          branchId: branchId !== undefined ? (branchId ? parseInt(branchId) : null) : undefined,
          name: name || undefined,
          contactPerson: contactPerson !== undefined ? contactPerson : undefined,
          email: email !== undefined ? email : undefined,
          phone: phone !== undefined ? phone : undefined,
          address: address !== undefined ? address : undefined,
          serviceType: serviceType || undefined,
        })
        .where(eq(vendors.id, id))
        .returning();

      if (assignedBranchIds !== undefined && Array.isArray(assignedBranchIds)) {
        await db.delete(vendorBranchAssignments).where(eq(vendorBranchAssignments.vendorId, id));
        const validIds = assignedBranchIds
          .map((bId: any) => parseInt(bId))
          .filter((bId: number) => !isNaN(bId) && bId !== updated.branchId);

        if (validIds.length > 0) {
          const rows = validIds.map((bId: number) => ({
            vendorId: id,
            branchId: bId,
            grantedByUserId: req.user?.id || 1,
          }));
          await db.insert(vendorBranchAssignments).values(rows);
        }
      }

      await logEntry(req, 'UPDATE_VENDOR', 'vendor', id, `Updated vendor ${updated.name}`);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating vendor:', error);
      res.status(500).json({ error: error.message || 'Failed to update vendor' });
    }
  });

  app.delete('/api/vendors/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(vendorBranchAssignments).where(eq(vendorBranchAssignments.vendorId, id));
      await db.delete(vendors).where(eq(vendors.id, id));
      await logEntry(req, 'DELETE_VENDOR', 'vendor', id, `Deleted vendor #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting vendor:', error);
      res.status(500).json({ error: error.message || 'Failed to delete vendor' });
    }
  });

  // 11. Pre-fed Request Reasons (available via /api/request-reasons and /api/reasons)
  const getReasonsHandler = async (req: AuthRequest, res: express.Response) => {
    try {
      const reasons = await db.select().from(requestReasons).where(eq(requestReasons.isActive, true)).orderBy(requestReasons.reason);
      res.json(reasons);
    } catch (error: any) {
      console.error('Error fetching request reasons:', error);
      res.status(500).json({ error: 'Failed to fetch request reasons' });
    }
  };

  const createReasonHandler = async (req: AuthRequest, res: express.Response) => {
    try {
      const { reason, categoryType } = req.body;
      if (!reason) {
        return res.status(400).json({ error: 'Reason description is required' });
      }
      const [created] = await db.insert(requestReasons).values({
        reason,
        categoryType: categoryType || 'all',
        isActive: true,
      }).returning();
      await logEntry(req, 'CREATE_REQUEST_REASON', 'reason', created.id, `Added pre-fed request reason: ${reason}`);
      res.json(created);
    } catch (error: any) {
      console.error('Error creating request reason:', error);
      res.status(500).json({ error: error.message || 'Failed to create request reason' });
    }
  };

  const updateReasonHandler = async (req: AuthRequest, res: express.Response) => {
    try {
      const id = parseInt(req.params.id);
      const { reason, categoryType, isActive } = req.body;
      const [updated] = await db.update(requestReasons)
        .set({
          reason: reason || undefined,
          categoryType: categoryType || undefined,
          isActive: isActive !== undefined ? !!isActive : undefined,
        })
        .where(eq(requestReasons.id, id))
        .returning();
      await logEntry(req, 'UPDATE_REQUEST_REASON', 'reason', id, `Updated request reason: ${updated.reason}`);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating request reason:', error);
      res.status(500).json({ error: error.message || 'Failed to update request reason' });
    }
  };

  const deleteReasonHandler = async (req: AuthRequest, res: express.Response) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(requestReasons).where(eq(requestReasons.id, id));
      await logEntry(req, 'DELETE_REQUEST_REASON', 'reason', id, `Deleted request reason #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting request reason:', error);
      res.status(500).json({ error: error.message || 'Failed to delete request reason' });
    }
  };

  app.get('/api/request-reasons', authMiddleware, getReasonsHandler);
  app.get('/api/reasons', authMiddleware, getReasonsHandler);
  app.post('/api/request-reasons', authMiddleware, createReasonHandler);
  app.post('/api/reasons', authMiddleware, createReasonHandler);
  app.put('/api/request-reasons/:id', authMiddleware, updateReasonHandler);
  app.put('/api/reasons/:id', authMiddleware, updateReasonHandler);
  app.delete('/api/request-reasons/:id', authMiddleware, deleteReasonHandler);
  app.delete('/api/reasons/:id', authMiddleware, deleteReasonHandler);

  // 12. Inventory (Assets and Consumables)
  app.get('/api/inventory', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, departmentId, type, categoryId, search, status, all } = req.query;
      const allowedCatIds = all === 'true' ? null : await getPermittedCategoryIdsForUser(req);

      // Role check: Managers & Department users are restricted to their branch
      let targetBranch = branchId ? parseInt(branchId as string) : undefined;
      if (req.user?.role === 'manager' || req.user?.role === 'department') {
        targetBranch = req.user.branchId || 1;
      }

      let items = await db.select().from(inventoryItems).orderBy(desc(inventoryItems.createdAt));

      // Enforce assigned category permissions for managers
      if (allowedCatIds !== null) {
        items = items.filter(i => allowedCatIds.includes(i.categoryId));
      }

      if (type) {
        items = items.filter(i => i.itemType === type);
      }
      if (categoryId) {
        items = items.filter(i => i.categoryId === parseInt(categoryId as string));
      }
      if (status) {
        items = items.filter(i => i.status === status);
      }
      if (search) {
        const s = (search as string).toLowerCase();
        items = items.filter(i => i.name.toLowerCase().includes(s) || i.code.toLowerCase().includes(s));
      }

      // Fetch stock location breakdowns
      const allStockLocs = await db.select().from(stockLocations);
      const allCategories = await db.select().from(categories);
      const catMap = new Map(allCategories.map(c => [c.id, c]));
      const allModels = await db.select().from(models);
      const modelMap = new Map(allModels.map(m => [m.id, m]));
      const allVendors = await db.select().from(vendors);
      const vendorMap = new Map(allVendors.map(v => [v.id, v]));

      // If branch filter applied, compute branch-specific quantities
      const enriched = items.map(item => {
        const locs = allStockLocs.filter(l => l.itemId === item.id);
        const branchLocs = targetBranch ? locs.filter(l => l.branchId === targetBranch) : locs;
        const branchQty = branchLocs.reduce((acc, cur) => acc + cur.quantity, 0);

        // Determine low stock status
        const isLow = item.availableQuantity <= item.minThreshold;

        return {
          ...item,
          branchQuantity: targetBranch ? branchQty : item.availableQuantity,
          category: catMap.get(item.categoryId),
          model: item.modelId ? modelMap.get(item.modelId) : null,
          supplier: item.supplierId ? vendorMap.get(item.supplierId) : null,
          isLowStock: isLow,
          stockLocations: locs,
        };
      });

      res.json(enriched);
    } catch (error: any) {
      console.error('Error fetching inventory:', error);
      res.status(500).json({ error: 'Failed to fetch inventory items' });
    }
  });

  app.post('/api/inventory', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const {
        code,
        name,
        itemType,
        categoryId,
        modelId,
        supplierId,
        uom,
        quantity,
        minThreshold,
        recordDate,
        customFieldsData,
        imageUrl,
        notes,
        branchId,
        departmentId,
        locationId,
        machineId,
      } = req.body;

      if (!code || !name || !itemType || !categoryId || !uom || quantity === undefined) {
        return res.status(400).json({ error: 'Code, name, itemType, category, UOM, and quantity are required' });
      }

      // Check category permission
      const allowedCatIds = await getPermittedCategoryIdsForUser(req);
      if (allowedCatIds !== null && !allowedCatIds.includes(parseInt(categoryId))) {
        return res.status(403).json({ error: 'Access Denied: You do not have permission to add items to this category.' });
      }

      const qty = parseFloat(quantity) || 1;
      const threshold = minThreshold ? parseFloat(minThreshold) : 5;
      const bId = branchId ? parseInt(branchId) : (req.user?.branchId || 1);

      const [created] = await db.insert(inventoryItems).values({
        code,
        name,
        itemType,
        categoryId: parseInt(categoryId),
        modelId: modelId ? parseInt(modelId) : null,
        supplierId: supplierId ? parseInt(supplierId) : null,
        uom,
        totalQuantity: qty,
        availableQuantity: qty,
        minThreshold: threshold,
        recordDate: recordDate || new Date().toISOString().split('T')[0],
        status: qty <= threshold ? 'low_stock' : 'available',
        customFieldsData: customFieldsData || {},
        imageUrl: imageUrl || null,
        notes: notes || null,
        engagementStatus: itemType === 'asset' ? 'idle' : null,
      }).returning();

      // Create initial stock location
      await db.insert(stockLocations).values({
        itemId: created.id,
        branchId: bId,
        departmentId: departmentId ? parseInt(departmentId) : null,
        locationId: locationId ? parseInt(locationId) : null,
        machineId: machineId ? parseInt(machineId) : null,
        quantity: qty,
      });

      await logEntry(req, 'CREATE_INVENTORY_ITEM', 'inventory', created.id, `Created ${itemType}: ${name} (${code}) with ${qty} ${uom}`, bId);
      res.json(created);
    } catch (error: any) {
      console.error('Error creating inventory item:', error);
      res.status(500).json({ error: error.message || 'Failed to create inventory item' });
    }
  });

  app.put('/api/inventory/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const {
        code,
        name,
        itemType,
        categoryId,
        modelId,
        supplierId,
        uom,
        totalQuantity,
        availableQuantity,
        minThreshold,
        recordDate,
        customFieldsData,
        imageUrl,
        notes,
        status,
      } = req.body;

      const allowedCatIds = await getPermittedCategoryIdsForUser(req);
      if (allowedCatIds !== null) {
        const [existing] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
        if (!existing || !allowedCatIds.includes(existing.categoryId)) {
          return res.status(403).json({ error: 'Access Denied: You do not have permission to manage items in this category.' });
        }
        if (categoryId && !allowedCatIds.includes(parseInt(categoryId))) {
          return res.status(403).json({ error: 'Access Denied: You do not have permission to move item into this category.' });
        }
      }

      const [updated] = await db.update(inventoryItems)
        .set({
          code: code || undefined,
          name: name || undefined,
          itemType: itemType || undefined,
          categoryId: categoryId ? parseInt(categoryId) : undefined,
          modelId: modelId !== undefined ? (modelId ? parseInt(modelId) : null) : undefined,
          supplierId: supplierId !== undefined ? (supplierId ? parseInt(supplierId) : null) : undefined,
          uom: uom || undefined,
          totalQuantity: totalQuantity !== undefined ? parseFloat(totalQuantity) : undefined,
          availableQuantity: availableQuantity !== undefined ? parseFloat(availableQuantity) : undefined,
          minThreshold: minThreshold !== undefined ? parseFloat(minThreshold) : undefined,
          recordDate: recordDate || undefined,
          customFieldsData: customFieldsData !== undefined ? customFieldsData : undefined,
          imageUrl: imageUrl !== undefined ? (imageUrl || null) : undefined,
          notes: notes !== undefined ? notes : undefined,
          status: status || undefined,
        })
        .where(eq(inventoryItems.id, id))
        .returning();

      await logEntry(req, 'UPDATE_INVENTORY_ITEM', 'inventory', id, `Updated inventory item ${updated.name} (${updated.code})`);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating inventory item:', error);
      res.status(500).json({ error: error.message || 'Failed to update inventory item' });
    }
  });

  app.delete('/api/inventory/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      // Clean up linked tables
      await db.delete(stockLocations).where(eq(stockLocations.itemId, id));
      await db.delete(inventoryMovements).where(eq(inventoryMovements.itemId, id));
      await db.delete(employeeRequests).where(eq(employeeRequests.itemId, id));
      await db.delete(vendorRepairs).where(eq(vendorRepairs.itemId, id));
      await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
      await logEntry(req, 'DELETE_INVENTORY_ITEM', 'inventory', id, `Deleted inventory item #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting inventory item:', error);
      res.status(500).json({ error: error.message || 'Failed to delete inventory item' });
    }
  });

  // 13. Movements & Transfers (Department to Department / Branch to Branch / Machine Assignment)
  app.get('/api/movements', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, itemId, status, all } = req.query;
      const allowedCatIds = all === 'true' ? null : await getPermittedCategoryIdsForUser(req);

      let movs = await db.select().from(inventoryMovements).orderBy(desc(inventoryMovements.createdAt));

      if (branchId) {
        const b = parseInt(branchId as string);
        movs = movs.filter(m => m.fromBranchId === b || m.toBranchId === b);
      }
      if (itemId) {
        movs = movs.filter(m => m.itemId === parseInt(itemId as string));
      }
      if (status) {
        movs = movs.filter(m => m.status === status);
      }

      // Enrich with branch, dept, location, item info
      const allItems = await db.select().from(inventoryItems);
      const itemMap = new Map(allItems.map(i => [i.id, i]));
      const allBranches = await db.select().from(branches);
      const bMap = new Map(allBranches.map(b => [b.id, b]));
      const allDepts = await db.select().from(departments);
      const dMap = new Map(allDepts.map(d => [d.id, d]));
      const allLocs = await db.select().from(locations);
      const lMap = new Map(allLocs.map(l => [l.id, l]));
      const allMchs = await db.select().from(machines);
      const mMap = new Map(allMchs.map(m => [m.id, m]));

      // Filter by category if user has restricted categories
      if (allowedCatIds !== null) {
        movs = movs.filter(m => {
          const itm = itemMap.get(m.itemId);
          return itm && allowedCatIds.includes(itm.categoryId);
        });
      }

      const enriched = movs.map(m => ({
        ...m,
        item: itemMap.get(m.itemId),
        fromBranch: bMap.get(m.fromBranchId),
        toBranch: bMap.get(m.toBranchId),
        fromDepartment: m.fromDepartmentId ? dMap.get(m.fromDepartmentId) : null,
        toDepartment: m.toDepartmentId ? dMap.get(m.toDepartmentId) : null,
        fromLocation: m.fromLocationId ? lMap.get(m.fromLocationId) : null,
        toLocation: m.toLocationId ? lMap.get(m.toLocationId) : null,
        toMachine: m.toMachineId ? mMap.get(m.toMachineId) : null,
      }));

      res.json(enriched);
    } catch (error: any) {
      console.error('Error fetching movements:', error);
      res.status(500).json({ error: 'Failed to fetch movement logs' });
    }
  });

  app.post('/api/movements', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const {
        itemId,
        quantity,
        movementType,
        fromBranchId,
        toBranchId,
        fromDepartmentId,
        toDepartmentId,
        fromLocationId,
        toLocationId,
        toMachineId,
        notes,
      } = req.body;

      if (!itemId || !quantity || !fromBranchId || !toBranchId) {
        return res.status(400).json({ error: 'Item, quantity, fromBranch, and toBranch are required' });
      }

      const qty = parseFloat(quantity);
      const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, parseInt(itemId)));
      if (!item) return res.status(404).json({ error: 'Item not found' });

      // Deduct from source stock location
      const sourceLocations = await db.select().from(stockLocations).where(
        and(
          eq(stockLocations.itemId, item.id),
          eq(stockLocations.branchId, parseInt(fromBranchId)),
          fromDepartmentId ? eq(stockLocations.departmentId, parseInt(fromDepartmentId)) : sql`1=1`
        )
      );

      const sourceLoc = sourceLocations[0];
      if (sourceLoc && sourceLoc.quantity >= qty) {
        await db.update(stockLocations)
          .set({ quantity: sourceLoc.quantity - qty })
          .where(eq(stockLocations.id, sourceLoc.id));
      }

      const isInterBranch = (movementType === 'branch_to_branch') && (parseInt(fromBranchId) !== parseInt(toBranchId));
      const movementStatus = isInterBranch ? 'pending_acceptance' : 'completed';

      // For local movements (dept_to_dept, assigned_to_machine, or intra-branch), allocate immediately
      if (!isInterBranch) {
        const destLocations = await db.select().from(stockLocations).where(
          and(
            eq(stockLocations.itemId, item.id),
            eq(stockLocations.branchId, parseInt(toBranchId)),
            toDepartmentId ? eq(stockLocations.departmentId, parseInt(toDepartmentId)) : sql`1=1`,
            toLocationId ? eq(stockLocations.locationId, parseInt(toLocationId)) : sql`1=1`,
            toMachineId ? eq(stockLocations.machineId, parseInt(toMachineId)) : sql`1=1`
          )
        );

        if (destLocations.length > 0) {
          await db.update(stockLocations)
            .set({ quantity: destLocations[0].quantity + qty })
            .where(eq(stockLocations.id, destLocations[0].id));
        } else {
          await db.insert(stockLocations).values({
            itemId: item.id,
            branchId: parseInt(toBranchId),
            departmentId: toDepartmentId ? parseInt(toDepartmentId) : null,
            locationId: toLocationId ? parseInt(toLocationId) : null,
            machineId: toMachineId ? parseInt(toMachineId) : null,
            quantity: qty,
          });
        }

        // If moving to a machine, mark asset as engaged
        if (toMachineId && item.itemType === 'asset') {
          await db.update(inventoryItems).set({
            engagementStatus: 'engaged',
            lastEngagedAt: new Date(),
            firstEngagedAt: item.firstEngagedAt || new Date(),
          }).where(eq(inventoryItems.id, item.id));
        }
      }

      const [movRecord] = await db.insert(inventoryMovements).values({
        itemId: item.id,
        quantity: qty,
        uom: item.uom,
        movementType: movementType || (isInterBranch ? 'branch_to_branch' : 'dept_to_dept'),
        status: movementStatus,
        fromBranchId: parseInt(fromBranchId),
        toBranchId: parseInt(toBranchId),
        fromDepartmentId: fromDepartmentId ? parseInt(fromDepartmentId) : null,
        toDepartmentId: isInterBranch ? null : (toDepartmentId ? parseInt(toDepartmentId) : null),
        fromLocationId: fromLocationId ? parseInt(fromLocationId) : null,
        toLocationId: isInterBranch ? null : (toLocationId ? parseInt(toLocationId) : null),
        toMachineId: isInterBranch ? null : (toMachineId ? parseInt(toMachineId) : null),
        movedByUserId: req.user?.id || 1,
        notes,
      }).returning();

      const logAction = isInterBranch ? 'INITIATE_BRANCH_TRANSFER' : 'MOVE_STOCK';
      const logDesc = isInterBranch
        ? `Initiated branch transfer of ${qty} ${item.uom} of ${item.name} (${item.code}) to Branch #${toBranchId} (Awaiting Manager Acceptance)`
        : `Moved ${qty} ${item.uom} of ${item.name} (${item.code}) [${movementType}]`;

      await logEntry(req, logAction, 'movement', movRecord.id, logDesc, parseInt(toBranchId));
      res.json(movRecord);
    } catch (error: any) {
      console.error('Error recording movement:', error);
      res.status(500).json({ error: error.message || 'Failed to process stock movement' });
    }
  });

  // Accept incoming branch transfer & allocate to destination department / location
  app.post('/api/movements/:id/accept', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { departmentId, locationId, machineId, notes } = req.body;

      const [movement] = await db.select().from(inventoryMovements).where(eq(inventoryMovements.id, id));
      if (!movement) {
        return res.status(404).json({ error: 'Movement record not found' });
      }

      if (movement.status !== 'pending_acceptance') {
        return res.status(400).json({ error: `Transfer is already ${movement.status}` });
      }

      // Check manager permission (manager of destination branch or admin/super_manager)
      if (req.user?.role === 'manager' && req.user.branchId && req.user.branchId !== movement.toBranchId) {
        return res.status(403).json({ error: 'Only the destination branch manager can accept this transfer' });
      }

      const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, movement.itemId));
      if (!item) return res.status(404).json({ error: 'Transferred item not found' });

      // Add to destination stock location
      const destLocations = await db.select().from(stockLocations).where(
        and(
          eq(stockLocations.itemId, movement.itemId),
          eq(stockLocations.branchId, movement.toBranchId),
          departmentId ? eq(stockLocations.departmentId, parseInt(departmentId)) : sql`1=1`,
          locationId ? eq(stockLocations.locationId, parseInt(locationId)) : sql`1=1`,
          machineId ? eq(stockLocations.machineId, parseInt(machineId)) : sql`1=1`
        )
      );

      if (destLocations.length > 0) {
        await db.update(stockLocations)
          .set({ quantity: destLocations[0].quantity + movement.quantity })
          .where(eq(stockLocations.id, destLocations[0].id));
      } else {
        await db.insert(stockLocations).values({
          itemId: movement.itemId,
          branchId: movement.toBranchId,
          departmentId: departmentId ? parseInt(departmentId) : null,
          locationId: locationId ? parseInt(locationId) : null,
          machineId: machineId ? parseInt(machineId) : null,
          quantity: movement.quantity,
        });
      }

      // If allocated to a machine and is asset, update engagement
      if (machineId && item.itemType === 'asset') {
        await db.update(inventoryItems).set({
          engagementStatus: 'engaged',
          lastEngagedAt: new Date(),
          firstEngagedAt: item.firstEngagedAt || new Date(),
        }).where(eq(inventoryItems.id, item.id));
      }

      const updatedNotes = notes
        ? (movement.notes ? `${movement.notes} | Acceptance note: ${notes}` : notes)
        : movement.notes;

      const [acceptedMovement] = await db.update(inventoryMovements)
        .set({
          status: 'accepted',
          toDepartmentId: departmentId ? parseInt(departmentId) : null,
          toLocationId: locationId ? parseInt(locationId) : null,
          toMachineId: machineId ? parseInt(machineId) : null,
          acceptedAt: new Date(),
          acceptedByUserId: req.user?.id || 1,
          notes: updatedNotes,
        })
        .where(eq(inventoryMovements.id, id))
        .returning();

      await logEntry(
        req,
        'ACCEPT_BRANCH_TRANSFER',
        'movement',
        id,
        `Branch manager accepted & allocated transfer #${id} (${movement.quantity} ${movement.uom} of ${item.name}) to Dept #${departmentId || 'General'}`,
        movement.toBranchId
      );

      res.json(acceptedMovement);
    } catch (error: any) {
      console.error('Error accepting branch transfer:', error);
      res.status(500).json({ error: error.message || 'Failed to accept branch transfer' });
    }
  });

  // Reject incoming branch transfer & return stock to source branch
  app.post('/api/movements/:id/reject', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { rejectionReason } = req.body;

      const [movement] = await db.select().from(inventoryMovements).where(eq(inventoryMovements.id, id));
      if (!movement) {
        return res.status(404).json({ error: 'Movement record not found' });
      }

      if (movement.status !== 'pending_acceptance') {
        return res.status(400).json({ error: `Transfer is already ${movement.status}` });
      }

      // Return stock back to source branch
      const sourceLocations = await db.select().from(stockLocations).where(
        and(
          eq(stockLocations.itemId, movement.itemId),
          eq(stockLocations.branchId, movement.fromBranchId),
          movement.fromDepartmentId ? eq(stockLocations.departmentId, movement.fromDepartmentId) : sql`1=1`
        )
      );

      if (sourceLocations.length > 0) {
        await db.update(stockLocations)
          .set({ quantity: sourceLocations[0].quantity + movement.quantity })
          .where(eq(stockLocations.id, sourceLocations[0].id));
      } else {
        await db.insert(stockLocations).values({
          itemId: movement.itemId,
          branchId: movement.fromBranchId,
          departmentId: movement.fromDepartmentId || null,
          locationId: movement.fromLocationId || null,
          quantity: movement.quantity,
        });
      }

      const [rejectedMovement] = await db.update(inventoryMovements)
        .set({
          status: 'rejected',
          rejectionReason: rejectionReason || 'Rejected by destination branch manager',
          acceptedAt: new Date(),
          acceptedByUserId: req.user?.id || 1,
        })
        .where(eq(inventoryMovements.id, id))
        .returning();

      await logEntry(
        req,
        'REJECT_BRANCH_TRANSFER',
        'movement',
        id,
        `Branch manager rejected transfer #${id}. Reason: ${rejectionReason || 'No reason provided'}. Stock returned to origin Branch #${movement.fromBranchId}.`,
        movement.toBranchId
      );

      res.json(rejectedMovement);
    } catch (error: any) {
      console.error('Error rejecting branch transfer:', error);
      res.status(500).json({ error: error.message || 'Failed to reject branch transfer' });
    }
  });

  // 14. Employee Requests & Manager Issuance
  app.get('/api/requests', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, departmentId, status, all } = req.query;
      const allowedCatIds = all === 'true' ? null : await getPermittedCategoryIdsForUser(req);

      let reqList = await db.select().from(employeeRequests).orderBy(desc(employeeRequests.requestedAt));

      if (req.user?.role === 'department') {
        const uDept = req.user.departmentId || 1;
        reqList = reqList.filter(r => r.departmentId === uDept);
      } else if (req.user?.role === 'manager') {
        const uBranch = req.user.branchId || 1;
        reqList = reqList.filter(r => r.branchId === uBranch);
      } else if (branchId) {
        reqList = reqList.filter(r => r.branchId === parseInt(branchId as string));
      }

      if (departmentId) {
        reqList = reqList.filter(r => r.departmentId === parseInt(departmentId as string));
      }
      if (status) {
        reqList = reqList.filter(r => r.status === status);
      }

      // Enrich with employee, item, department, machine names
      const allEmps = await db.select().from(employees);
      const empMap = new Map(allEmps.map(e => [e.id, e]));
      const allItems = await db.select().from(inventoryItems);
      const itemMap = new Map(allItems.map(i => [i.id, i]));
      const allDepts = await db.select().from(departments);
      const deptMap = new Map(allDepts.map(d => [d.id, d]));
      const allMachines = await db.select().from(machines);
      const machineMap = new Map(allMachines.map(m => [m.id, m]));

      // Filter by category if user has restricted categories
      if (allowedCatIds !== null) {
        reqList = reqList.filter(r => {
          const itm = itemMap.get(r.itemId);
          return itm && allowedCatIds.includes(itm.categoryId);
        });
      }

      const enriched = reqList.map(r => ({
        ...r,
        employee: empMap.get(r.employeeId),
        item: itemMap.get(r.itemId),
        department: deptMap.get(r.departmentId),
        machine: r.machineId ? machineMap.get(r.machineId) : null,
      }));

      res.json(enriched);
    } catch (error: any) {
      console.error('Error fetching employee requests:', error);
      res.status(500).json({ error: 'Failed to fetch requests' });
    }
  });

  app.post('/api/requests', async (req, res) => {
    try {
      const {
        securityPinEntered,
        branchId,
        departmentId,
        itemId,
        requestedQty,
        reasonId,
        reasonText,
        machineId,
      } = req.body;

      if (!securityPinEntered || securityPinEntered.length !== 4) {
        return res.status(400).json({ error: '4-digit employee security PIN code is required' });
      }
      if (!branchId || !departmentId || !itemId || !requestedQty || !reasonText) {
        return res.status(400).json({ error: 'Branch, department, item, quantity, and reason are required' });
      }

      // Verify employee
      const [emp] = await db.select().from(employees).where(
        and(
          eq(employees.userCode, securityPinEntered),
          eq(employees.isActive, true)
        )
      );

      if (!emp) {
        return res.status(401).json({ error: 'Security PIN verification failed. No active employee with this 4-digit code.' });
      }

      const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, parseInt(itemId)));
      if (!item) return res.status(404).json({ error: 'Selected item not found' });

      const reqId = `REQ-${Date.now().toString().slice(-6)}`;
      const qty = parseFloat(requestedQty);

      const [created] = await db.insert(employeeRequests).values({
        requestId: reqId,
        employeeId: emp.id,
        branchId: parseInt(branchId),
        departmentId: parseInt(departmentId),
        itemId: item.id,
        requestedQty: qty,
        uom: item.uom,
        reasonId: reasonId ? parseInt(reasonId) : null,
        reasonText,
        machineId: machineId ? parseInt(machineId) : null,
        securityPinEntered: '****', // Masked for privacy
        status: 'pending',
      }).returning();

      // Log entry
      await db.insert(entryLogs).values({
        userId: emp.id,
        userName: `${emp.name} (Emp #${emp.employeeCode})`,
        userRole: 'department',
        branchId: parseInt(branchId),
        action: 'EMPLOYEE_REQUEST_PLACED',
        entityType: 'request',
        entityId: reqId,
        details: `Requested ${qty} ${item.uom} of ${item.name} (${item.code}). Reason: ${reasonText}`,
      });

      res.json(created);
    } catch (error: any) {
      console.error('Error submitting employee request:', error);
      res.status(500).json({ error: error.message || 'Failed to submit request' });
    }
  });

  // Manager Issue Request
  app.post('/api/requests/:id/issue', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { managerNotes } = req.body;

      const [request] = await db.select().from(employeeRequests).where(eq(employeeRequests.id, parseInt(id)));
      if (!request) return res.status(404).json({ error: 'Request not found' });
      if (request.status !== 'pending') return res.status(400).json({ error: 'Request is already processed' });

      const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, request.itemId));
      if (!item) return res.status(404).json({ error: 'Item not found' });

      if (item.availableQuantity < request.requestedQty) {
        return res.status(400).json({
          error: `Insufficient stock. Requested: ${request.requestedQty} ${item.uom}, Available: ${item.availableQuantity} ${item.uom}`,
        });
      }

      // Deduct available stock
      const newAvail = item.availableQuantity - request.requestedQty;
      const isLow = newAvail <= item.minThreshold;

      await db.update(inventoryItems).set({
        availableQuantity: newAvail,
        status: isLow ? 'low_stock' : item.status,
        engagementStatus: item.itemType === 'asset' ? 'engaged' : item.engagementStatus,
        lastEngagedAt: new Date(),
        firstEngagedAt: item.firstEngagedAt || new Date(),
      }).where(eq(inventoryItems.id, item.id));

      // Update stock location
      const stockLocs = await db.select().from(stockLocations).where(
        and(
          eq(stockLocations.itemId, item.id),
          eq(stockLocations.branchId, request.branchId),
          eq(stockLocations.departmentId, request.departmentId)
        )
      );

      if (stockLocs.length > 0 && stockLocs[0].quantity >= request.requestedQty) {
        await db.update(stockLocations)
          .set({ quantity: stockLocs[0].quantity - request.requestedQty })
          .where(eq(stockLocations.id, stockLocs[0].id));
      }

      // Update request status
      const [updatedReq] = await db.update(employeeRequests).set({
        status: 'issued',
        issuedAt: new Date(),
        issuedByUserId: req.user?.id || 1,
        managerNotes: managerNotes || 'Approved and issued by branch manager',
      }).where(eq(employeeRequests.id, parseInt(id))).returning();

      // Record movement / issue log
      await db.insert(inventoryMovements).values({
        itemId: item.id,
        quantity: request.requestedQty,
        uom: request.uom,
        movementType: 'issued_to_employee',
        fromBranchId: request.branchId,
        toBranchId: request.branchId,
        fromDepartmentId: request.departmentId,
        toDepartmentId: request.departmentId,
        toMachineId: request.machineId,
        movedByUserId: req.user?.id || 1,
        notes: `Issued to Employee #${request.employeeId} on Request ${request.requestId}`,
      });

      await logEntry(
        req,
        'ISSUE_REQUEST',
        'request',
        request.requestId,
        `Manager issued ${request.requestedQty} ${request.uom} of ${item.name} to Employee #${request.employeeId}`,
        request.branchId
      );

      res.json(updatedReq);
    } catch (error: any) {
      console.error('Error issuing request:', error);
      res.status(500).json({ error: error.message || 'Failed to issue item' });
    }
  });

  // Manager Reject Request
  app.post('/api/requests/:id/reject', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { managerNotes } = req.body;

      const [updated] = await db.update(employeeRequests).set({
        status: 'rejected',
        managerNotes: managerNotes || 'Rejected by branch manager',
      }).where(eq(employeeRequests.id, parseInt(id))).returning();

      await logEntry(req, 'REJECT_REQUEST', 'request', updated.requestId, `Rejected request ${updated.requestId}: ${managerNotes || 'No reason provided'}`, updated.branchId);
      res.json(updated);
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      res.status(500).json({ error: error.message || 'Failed to reject request' });
    }
  });

  app.put('/api/requests/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { requestedQty, reasonId, reasonText, machineId, managerNotes, status } = req.body;
      const [updated] = await db.update(employeeRequests)
        .set({
          requestedQty: requestedQty !== undefined ? parseFloat(requestedQty) : undefined,
          reasonId: reasonId !== undefined ? (reasonId ? parseInt(reasonId) : null) : undefined,
          reasonText: reasonText || undefined,
          machineId: machineId !== undefined ? (machineId ? parseInt(machineId) : null) : undefined,
          managerNotes: managerNotes !== undefined ? managerNotes : undefined,
          status: status || undefined,
        })
        .where(eq(employeeRequests.id, id))
        .returning();
      await logEntry(req, 'UPDATE_REQUEST', 'request', updated.requestId, `Updated request ${updated.requestId}`);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating request:', error);
      res.status(500).json({ error: error.message || 'Failed to update request' });
    }
  });

  app.delete('/api/requests/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const [reqRecord] = await db.select().from(employeeRequests).where(eq(employeeRequests.id, id));
      await db.delete(employeeRequests).where(eq(employeeRequests.id, id));
      await logEntry(req, 'DELETE_REQUEST', 'request', reqRecord ? reqRecord.requestId : id.toString(), `Deleted request #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting request:', error);
      res.status(500).json({ error: error.message || 'Failed to delete request' });
    }
  });

  // 15. Vendor Repairs & Engagement Tracking
  app.get('/api/repairs', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, status, all } = req.query;
      const allowedCatIds = all === 'true' ? null : await getPermittedCategoryIdsForUser(req);

      let repairList = await db.select().from(vendorRepairs).orderBy(desc(vendorRepairs.createdAt));

      if (req.user?.role === 'manager') {
        const uBranch = req.user.branchId || 1;
        repairList = repairList.filter(r => r.branchId === uBranch);
      } else if (branchId) {
        repairList = repairList.filter(r => r.branchId === parseInt(branchId as string));
      }

      if (status) {
        repairList = repairList.filter(r => r.status === status);
      }

      const allItems = await db.select().from(inventoryItems);
      const itemMap = new Map(allItems.map(i => [i.id, i]));
      const allVendors = await db.select().from(vendors);
      const vendorMap = new Map(allVendors.map(v => [v.id, v]));
      const allBranches = await db.select().from(branches);
      const bMap = new Map(allBranches.map(b => [b.id, b]));

      // Filter by category if user has restricted categories
      if (allowedCatIds !== null) {
        repairList = repairList.filter(r => {
          const itm = itemMap.get(r.itemId);
          return itm && allowedCatIds.includes(itm.categoryId);
        });
      }

      const enriched = repairList.map(r => ({
        ...r,
        item: itemMap.get(r.itemId),
        vendor: vendorMap.get(r.vendorId),
        branch: bMap.get(r.branchId),
      }));

      res.json(enriched);
    } catch (error: any) {
      console.error('Error fetching repair logs:', error);
      res.status(500).json({ error: 'Failed to fetch repair records' });
    }
  });

  app.post('/api/repairs', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { itemId, vendorId, branchId, sentDate, expectedReturnDate, issueDescription, repairCost, managerNotes } = req.body;

      if (!itemId || !vendorId || !issueDescription) {
        return res.status(400).json({ error: 'Item, vendor, and issue description are required' });
      }

      const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, parseInt(itemId)));
      if (!item) return res.status(404).json({ error: 'Asset not found' });

      // Calculate how long asset was engaged before repair
      let engagementMinutes = item.totalEngagementMinutes || 0;
      if (item.lastEngagedAt) {
        const now = new Date().getTime();
        const start = new Date(item.lastEngagedAt).getTime();
        const diffMinutes = Math.max(0, Math.floor((now - start) / 60000));
        engagementMinutes += diffMinutes;
      }

      const bId = branchId ? parseInt(branchId) : (req.user?.branchId || 1);

      const [created] = await db.insert(vendorRepairs).values({
        itemId: item.id,
        vendorId: parseInt(vendorId),
        branchId: bId,
        sentDate: sentDate || new Date().toISOString().split('T')[0],
        expectedReturnDate: expectedReturnDate || null,
        issueDescription,
        repairCost: repairCost ? parseFloat(repairCost) : 0,
        status: 'sent_to_vendor',
        engagedDurationMinutes: engagementMinutes,
        managerNotes,
      }).returning();

      // Update asset status
      await db.update(inventoryItems).set({
        status: 'in_repair',
        engagementStatus: 'repaired',
        totalEngagementMinutes: engagementMinutes,
      }).where(eq(inventoryItems.id, item.id));

      // Record movement to vendor
      await db.insert(inventoryMovements).values({
        itemId: item.id,
        quantity: 1,
        uom: item.uom,
        movementType: 'sent_to_vendor',
        fromBranchId: bId,
        toBranchId: bId,
        movedByUserId: req.user?.id || 1,
        notes: `Asset sent to vendor for repair: ${issueDescription}. Engaged duration: ${Math.floor(engagementMinutes / 60)}h`,
      });

      await logEntry(req, 'SEND_TO_VENDOR_REPAIR', 'repair', created.id, `Sent ${item.name} (${item.code}) to vendor #${vendorId}. Logged engagement: ${Math.floor(engagementMinutes / 60)} hours`, bId);
      res.json(created);
    } catch (error: any) {
      console.error('Error creating repair record:', error);
      res.status(500).json({ error: error.message || 'Failed to send asset for repair' });
    }
  });

  app.post('/api/repairs/:id/return', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { returnedDate, finalCost, managerNotes, departmentId, locationId } = req.body;

      const [repair] = await db.select().from(vendorRepairs).where(eq(vendorRepairs.id, parseInt(id)));
      if (!repair) return res.status(404).json({ error: 'Repair record not found' });

      const [updated] = await db.update(vendorRepairs).set({
        status: 'returned',
        returnedDate: returnedDate || new Date().toISOString().split('T')[0],
        repairCost: finalCost !== undefined ? parseFloat(finalCost) : repair.repairCost,
        managerNotes: managerNotes || repair.managerNotes,
      }).where(eq(vendorRepairs.id, parseInt(id))).returning();

      // Put asset back to available status
      await db.update(inventoryItems).set({
        status: 'available',
        engagementStatus: 'idle',
      }).where(eq(inventoryItems.id, repair.itemId));

      // Update location
      const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, repair.itemId));
      if (item) {
        await db.insert(inventoryMovements).values({
          itemId: item.id,
          quantity: 1,
          uom: item.uom,
          movementType: 'returned_from_vendor',
          fromBranchId: repair.branchId,
          toBranchId: repair.branchId,
          toDepartmentId: departmentId ? parseInt(departmentId) : null,
          toLocationId: locationId ? parseInt(locationId) : null,
          movedByUserId: req.user?.id || 1,
          notes: `Asset received back repaired from vendor. Cost: $${finalCost || repair.repairCost}`,
        });
      }

      await logEntry(req, 'RETURN_FROM_VENDOR_REPAIR', 'repair', id, `Received asset #${repair.itemId} repaired from vendor #${repair.vendorId}`, repair.branchId);
      res.json(updated);
    } catch (error: any) {
      console.error('Error returning repaired asset:', error);
      res.status(500).json({ error: error.message || 'Failed to complete repair return' });
    }
  });

  app.post('/api/repairs/:id/trash', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const [repair] = await db.select().from(vendorRepairs).where(eq(vendorRepairs.id, parseInt(id)));
      if (!repair) return res.status(404).json({ error: 'Repair record not found' });

      const [updated] = await db.update(vendorRepairs).set({
        status: 'unrepairable_trashed',
        managerNotes: `Asset declared unrepairable and trashed: ${reason || 'Excessive repair cost / damage'}`,
      }).where(eq(vendorRepairs.id, parseInt(id))).returning();

      // Mark asset trashed
      await db.update(inventoryItems).set({
        status: 'trashed',
        engagementStatus: 'trashed',
        availableQuantity: 0,
      }).where(eq(inventoryItems.id, repair.itemId));

      await logEntry(req, 'TRASH_ASSET', 'repair', id, `Asset #${repair.itemId} declared unrepairable and decommissioned / trashed. Total active engagement: ${Math.floor((repair.engagedDurationMinutes || 0) / 60)} hours`, repair.branchId);
      res.json(updated);
    } catch (error: any) {
      console.error('Error trashing asset:', error);
      res.status(500).json({ error: error.message || 'Failed to trash asset' });
    }
  });

  app.put('/api/repairs/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { vendorId, branchId, sentDate, expectedReturnDate, returnedDate, issueDescription, repairCost, status, managerNotes } = req.body;

      const [updated] = await db.update(vendorRepairs)
        .set({
          vendorId: vendorId ? parseInt(vendorId) : undefined,
          branchId: branchId ? parseInt(branchId) : undefined,
          sentDate: sentDate || undefined,
          expectedReturnDate: expectedReturnDate !== undefined ? expectedReturnDate : undefined,
          returnedDate: returnedDate !== undefined ? returnedDate : undefined,
          issueDescription: issueDescription || undefined,
          repairCost: repairCost !== undefined ? parseFloat(repairCost) : undefined,
          status: status || undefined,
          managerNotes: managerNotes !== undefined ? managerNotes : undefined,
        })
        .where(eq(vendorRepairs.id, id))
        .returning();

      await logEntry(req, 'UPDATE_REPAIR', 'repair', id, `Updated repair record #${id}`);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating repair:', error);
      res.status(500).json({ error: error.message || 'Failed to update repair record' });
    }
  });

  app.delete('/api/repairs/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(vendorRepairs).where(eq(vendorRepairs.id, id));
      await logEntry(req, 'DELETE_REPAIR', 'repair', id, `Deleted repair record #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting repair:', error);
      res.status(500).json({ error: error.message || 'Failed to delete repair record' });
    }
  });

  // 16. Audit / Entry Logs
  app.get('/api/logs', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, entityType, limit } = req.query;
      let logList = await db.select().from(entryLogs).orderBy(desc(entryLogs.createdAt));

      if (req.user?.role === 'manager' || req.user?.role === 'department') {
        const uBranch = req.user.branchId || 1;
        logList = logList.filter(l => l.branchId === uBranch || !l.branchId);
      } else if (branchId) {
        logList = logList.filter(l => l.branchId === parseInt(branchId as string));
      }

      if (entityType) {
        logList = logList.filter(l => l.entityType === entityType);
      }

      const take = limit ? parseInt(limit as string) : 100;
      res.json(logList.slice(0, take));
    } catch (error: any) {
      console.error('Error fetching logs:', error);
      res.status(500).json({ error: 'Failed to fetch entry logs' });
    }
  });

  // 17. Dashboard Stats & Low Stock Warnings
  app.get('/api/dashboard-stats', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, all } = req.query;
      const allowedCatIds = all === 'true' ? null : await getPermittedCategoryIdsForUser(req);
      const targetBranch = (req.user?.role === 'manager' || req.user?.role === 'department')
        ? (req.user.branchId || 1)
        : (branchId ? parseInt(branchId as string) : null);

      let allItems = await db.select().from(inventoryItems);
      let allRequests = await db.select().from(employeeRequests);
      let allRepairs = await db.select().from(vendorRepairs);
      let allMovements = await db.select().from(inventoryMovements);

      const itemMap = new Map(allItems.map(i => [i.id, i]));

      if (allowedCatIds !== null) {
        allItems = allItems.filter(i => allowedCatIds.includes(i.categoryId));
        allRequests = allRequests.filter(r => {
          const itm = itemMap.get(r.itemId);
          return itm && allowedCatIds.includes(itm.categoryId);
        });
        allRepairs = allRepairs.filter(r => {
          const itm = itemMap.get(r.itemId);
          return itm && allowedCatIds.includes(itm.categoryId);
        });
        allMovements = allMovements.filter(m => {
          const itm = itemMap.get(m.itemId);
          return itm && allowedCatIds.includes(itm.categoryId);
        });
      }

      if (targetBranch) {
        allRequests = allRequests.filter(r => r.branchId === targetBranch);
        allRepairs = allRepairs.filter(r => r.branchId === targetBranch);
      }

      const assets = allItems.filter(i => i.itemType === 'asset');
      const consumables = allItems.filter(i => i.itemType === 'consumable');
      const lowStockItems = allItems.filter(i => i.availableQuantity <= i.minThreshold);
      const engagedAssets = assets.filter(i => i.engagementStatus === 'engaged' || i.status === 'in_use');
      const activeRepairs = allRepairs.filter(r => r.status === 'sent_to_vendor');
      const pendingRequests = allRequests.filter(r => r.status === 'pending');
      const pendingTransfers = allMovements.filter(m =>
        m.movementType === 'branch_to_branch' &&
        m.status === 'pending_acceptance' &&
        (targetBranch ? m.toBranchId === targetBranch : true)
      );

      res.json({
        totalAssets: assets.length,
        totalConsumables: consumables.length,
        lowStockCount: lowStockItems.length,
        lowStockItems: lowStockItems.slice(0, 10),
        engagedAssetsCount: engagedAssets.length,
        activeRepairsCount: activeRepairs.length,
        pendingRequestsCount: pendingRequests.length,
        pendingTransfersCount: pendingTransfers.length,
        recentMovementsCount: allMovements.length,
      });
    } catch (error: any) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });

  // 18. PostgreSQL Server Configuration & Live Diagnostics (Admin / Super Manager)
  app.get('/api/postgres-config', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'super_manager') {
        return res.status(403).json({ error: 'Access Denied: Administrator role required for Database Configuration.' });
      }

      // Query PostgreSQL system information
      let version = 'PostgreSQL (Connected)';
      let dbName = process.env.SQL_DB_NAME || process.env.PGDATABASE || 'assetflow_db';
      let dbSize = 'Unknown';
      let activeConnections = 1;
      let startTime: string | undefined;

      try {
        const versionResult = await pool.query('SELECT version();');
        if (versionResult.rows?.[0]?.version) {
          version = versionResult.rows[0].version;
        }

        const dbInfoResult = await pool.query(`
          SELECT 
            current_database() as db_name,
            pg_size_pretty(pg_database_size(current_database())) as db_size,
            pg_postmaster_start_time() as start_time
        `);
        if (dbInfoResult.rows?.[0]) {
          dbName = dbInfoResult.rows[0].db_name || dbName;
          dbSize = dbInfoResult.rows[0].db_size || dbSize;
          startTime = dbInfoResult.rows[0].start_time ? new Date(dbInfoResult.rows[0].start_time).toISOString() : undefined;
        }

        const connResult = await pool.query(`
          SELECT count(*)::int as active_conns 
          FROM pg_stat_activity 
          WHERE datname = current_database();
        `);
        if (connResult.rows?.[0]?.active_conns !== undefined) {
          activeConnections = connResult.rows[0].active_conns;
        }
      } catch (err: any) {
        console.warn('Could not query all pg_stat metrics:', err?.message);
      }

      // Table row counts for all main tables
      const [
        branchesCount,
        departmentsCount,
        machinesCount,
        employeesCount,
        categoriesCount,
        customFieldsCount,
        modelsCount,
        vendorsCount,
        inventoryItemsCount,
        employeeRequestsCount,
        inventoryMovementsCount,
        vendorRepairsCount,
        entryLogsCount,
        usersCount,
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(branches).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(departments).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(machines).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(employees).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(categories).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(customFields).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(models).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(vendors).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(inventoryItems).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(employeeRequests).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(inventoryMovements).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(vendorRepairs).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(entryLogs).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(users).then(r => Number(r[0]?.count || 0)).catch(() => 0),
      ]);

      const tableStats = [
        { tableName: 'inventory_items', rowCount: inventoryItemsCount, description: 'Assets & Consumables' },
        { tableName: 'inventory_movements', rowCount: inventoryMovementsCount, description: 'Stock Transfers & Tracking' },
        { tableName: 'employee_requests', rowCount: employeeRequestsCount, description: 'Department Issuances & Requisitions' },
        { tableName: 'vendor_repairs', rowCount: vendorRepairsCount, description: 'Vendor Repairs & Engagements' },
        { tableName: 'branches', rowCount: branchesCount, description: 'Branch Facilities' },
        { tableName: 'departments', rowCount: departmentsCount, description: 'Departments & Production Areas' },
        { tableName: 'machines', rowCount: machinesCount, description: 'Machinery & Equipment' },
        { tableName: 'employees', rowCount: employeesCount, description: 'Authorized Personnel' },
        { tableName: 'categories', rowCount: categoriesCount, description: 'Item & Asset Categories' },
        { tableName: 'custom_fields', rowCount: customFieldsCount, description: 'Dynamic Fields & Specs' },
        { tableName: 'models', rowCount: modelsCount, description: 'Predefined Asset Models' },
        { tableName: 'vendors', rowCount: vendorsCount, description: 'Vendors & Suppliers' },
        { tableName: 'entry_logs', rowCount: entryLogsCount, description: 'Immutable Audit Trail Logs' },
        { tableName: 'users', rowCount: usersCount, description: 'System Users & Role Access' },
      ];

      const port = process.env.SQL_PORT ? parseInt(process.env.SQL_PORT) : (process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432);
      const host = process.env.SQL_HOST || process.env.PGHOST || 'localhost';
      const user = process.env.SQL_USER || process.env.SQL_ADMIN_USER || process.env.PGUSER || 'postgres';
      const ssl = process.env.SQL_SSL === 'true' || process.env.SQL_SSL === 'require' || process.env.PGSSLMODE === 'require';
      const poolMax = process.env.SQL_POOL_MAX ? parseInt(process.env.SQL_POOL_MAX) : 10;

      res.json({
        connected: true,
        serverVersion: version,
        databaseName: dbName,
        host,
        port,
        user,
        ssl,
        poolMax,
        databaseSize: dbSize,
        activeConnections,
        serverStartTime: startTime,
        tableStats,
        environment: {
          nodeEnv: process.env.NODE_ENV || 'development',
          hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
          hasSqlHost: Boolean(process.env.SQL_HOST || process.env.PGHOST),
          hasSqlUser: Boolean(process.env.SQL_USER || process.env.SQL_ADMIN_USER || process.env.PGUSER),
          hasSqlPassword: Boolean(process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD || process.env.PGPASSWORD),
          hasSqlDbName: Boolean(process.env.SQL_DB_NAME || process.env.PGDATABASE),
        },
      });
    } catch (error: any) {
      console.error('Error fetching PostgreSQL configuration:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch database configuration' });
    }
  });

  // Test live connection with custom parameters
  app.post('/api/postgres-config/test', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access Denied: Administrator role required to test database connections.' });
      }

      const { host, port, user, password, database, ssl, connectionString } = req.body;

      const startTime = Date.now();
      let testClient: Client;

      if (connectionString) {
        testClient = new Client({
          connectionString,
          ssl: ssl ? { rejectUnauthorized: false } : undefined,
          connectionTimeoutMillis: 8000,
        });
      } else {
        testClient = new Client({
          host: host || 'localhost',
          port: port ? parseInt(port) : 5432,
          user: user || 'postgres',
          password: password !== undefined ? String(password) : undefined,
          database: database || 'postgres',
          ssl: ssl ? { rejectUnauthorized: false } : undefined,
          connectionTimeoutMillis: 8000,
        });
      }

      try {
        await testClient.connect();
        const latencyMs = Date.now() - startTime;
        const testResult = await testClient.query('SELECT version(), current_database(), current_user;');
        await testClient.end();

        const row = testResult.rows[0] || {};
        res.json({
          success: true,
          latencyMs,
          serverVersion: row.version,
          databaseName: row.current_database,
          currentUser: row.current_user,
        });
      } catch (clientErr: any) {
        try {
          await testClient.end();
        } catch (_) {}
        res.status(400).json({
          success: false,
          latencyMs: Date.now() - startTime,
          error: clientErr.message || 'Connection test failed',
        });
      }
    } catch (error: any) {
      console.error('Test connection error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to run connection test' });
    }
  });

  // Optimize & Vacuum DB
  app.post('/api/postgres-config/vacuum', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access Denied: Administrator role required.' });
      }

      await pool.query('VACUUM ANALYZE;');
      await logEntry(req, 'VACUUM_ANALYZE', 'SYSTEM_DATABASE', '0', 'PostgreSQL database vacuum and analyze triggered by admin');

      res.json({ success: true, message: 'Database optimized successfully. VACUUM ANALYZE completed.' });
    } catch (error: any) {
      console.error('Vacuum error:', error);
      res.status(500).json({ error: error.message || 'Failed to run database vacuum' });
    }
  });

  // API 404 handler (prevents unmatched /api/* from falling through to HTML SPA page)
  app.use('/api', (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.originalUrl} not found` });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
