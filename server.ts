import express from 'express';
import path from 'path';
import fs from 'fs';
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
  pmPlans,
  pmSchedules,
  pmWorkOrders,
  users,
} from './src/db/schema.ts';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from './src/middleware/auth.ts';
import { seedDatabase } from './src/db/seed.ts';
import { initializeDatabaseSchema, SCHEMA_TABLES } from './src/db/initDb.ts';
import { hashPassword, verifyPassword, isPasswordHashed } from './src/lib/auth-crypto.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  // Auto-initialize PostgreSQL database schema, tables, indexes, and seed default data on startup
  initializeDatabaseSchema()
    .then((res) => console.log(`[PostgreSQL] Startup schema verification: ${res.message}`))
    .catch((err) => console.error('[PostgreSQL] Startup schema initialization error:', err));

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
    // Managers & Department users are restricted to their assigned categories if explicitly configured
    if (req.user.role === 'manager' || req.user.role === 'department') {
      const userId = req.user.id;
      if (!userId) return null;
      const perms = await db.select().from(userCategoryPermissions).where(
        and(
          eq(userCategoryPermissions.userId, userId),
          eq(userCategoryPermissions.canManage, true)
        )
      );
      return perms.length > 0 ? perms.map(p => p.categoryId) : null;
    }
    return null;
  }

  // ==========================================
  // API ROUTES
  // ==========================================

  // 1. Health, Authentication & Current User Context
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Custom User Authentication (Login by Email/Username and Password)
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, identifier, password } = req.body;
      const loginId = (email || identifier || '').trim().toLowerCase();
      const loginPass = (password || '').trim();

      if (!loginId) {
        return res.status(400).json({ error: 'Email or username is required' });
      }

      const envAdminUser = (process.env.ADMIN_USER || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
      const envAdminPass = (process.env.ADMIN_PASSWORD || '').trim();

      // Query user in DB by email or UID or userCode or role
      const allUsers = await db.select().from(users);
      let user = allUsers.find(
        (u) =>
          u.email.toLowerCase() === loginId ||
          u.name.toLowerCase() === loginId ||
          u.uid.toLowerCase() === loginId ||
          (u.userCode && u.userCode.toLowerCase() === loginId) ||
          (loginId === 'admin' && u.role === 'admin') ||
          (envAdminUser && loginId === envAdminUser && u.role === 'admin')
      );

      // If user matched env admin credentials directly but wasn't in DB yet
      if (!user && (loginId === 'admin' || (envAdminUser && loginId === envAdminUser))) {
        if (envAdminPass && loginPass === envAdminPass) {
          const [newAdmin] = await db.insert(users).values({
            uid: `admin_${Date.now()}`,
            name: process.env.ADMIN_NAME || 'System Administrator',
            email: envAdminUser || 'admin@company.local',
            password: hashPassword(envAdminPass),
            role: 'admin',
            isActive: true,
          }).returning();
          user = newAdmin;
        }
      }

      if (!user) {
        return res.status(401).json({ error: 'Account not found with provided credentials.' });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: 'This user account is inactive. Please contact your system administrator.' });
      }

      // Verify password with strong bcrypt encryption
      const storedPass = user.password;
      const isEnvAdminMatch = Boolean(
        user.role === 'admin' && envAdminPass && loginPass === envAdminPass
      );

      const isValid = isEnvAdminMatch || verifyPassword(loginPass, storedPass, user.role);

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid password. Please try again.' });
      }

      // Transparent upgrade to strong bcrypt hash if password was stored unhashed
      if (storedPass && !isPasswordHashed(storedPass)) {
        try {
          const encryptedHash = hashPassword(loginPass);
          await db.update(users).set({ password: encryptedHash }).where(eq(users.id, user.id));
          console.log(`[Auth] Upgraded password for user #${user.id} to strong bcrypt encryption.`);
        } catch (upgradeErr) {
          console.warn('[Auth] Password re-hash upgrade warning:', upgradeErr);
        }
      }

      // Fetch user's branch and department
      const [branchInfo] = user.branchId ? await db.select().from(branches).where(eq(branches.id, user.branchId)) : [null];
      const [deptInfo] = user.departmentId ? await db.select().from(departments).where(eq(departments.id, user.departmentId)) : [null];

      // Fetch category permissions
      const perms = await db.select().from(userCategoryPermissions).where(eq(userCategoryPermissions.userId, user.id));
      const assignedCategoryIds = perms.filter((p) => p.canManage).map((p) => p.categoryId);

      const sanitizedUser = {
        id: user.id,
        uid: user.uid,
        email: user.email,
        name: user.name,
        role: user.role,
        branchId: user.branchId,
        departmentId: user.departmentId,
        userCode: user.userCode,
        isActive: user.isActive,
        branch: branchInfo,
        department: deptInfo,
        assignedCategoryIds,
      };

      // Write login audit log
      try {
        await db.insert(entryLogs).values({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          branchId: user.branchId || 1,
          action: 'USER_LOGIN',
          entityType: 'auth',
          entityId: String(user.id),
          details: `User ${user.name} (${user.email}) logged in successfully as ${user.role}`,
        });
      } catch (logErr) {
        console.error('Failed to log login entry:', logErr);
      }

      res.json({
        success: true,
        user: sanitizedUser,
        message: `Welcome back, ${user.name}!`,
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ error: error.message || 'Authentication failed' });
    }
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
      const force = req.body?.force !== false;
      await seedDatabase(force);
      await logEntry(req, 'SEED_DATABASE', 'system', 'SEED', 'Demo dataset seeded with comprehensive sample records');
      res.json({ success: true, message: 'Database populated with comprehensive sample data for all records' });
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
  const handleVerifyEmployeePin = async (req: express.Request, res: express.Response) => {
    try {
      const userCode = req.body.userCode || req.body.pin || req.body.code;
      const branchId = req.body.branchId ? parseInt(req.body.branchId) : undefined;
      const departmentId = req.body.departmentId ? parseInt(req.body.departmentId) : undefined;

      if (!userCode || String(userCode).trim().length !== 4) {
        return res.status(400).json({ error: 'Please enter a valid 4-digit numeric code' });
      }

      const codeStr = String(userCode).trim();
      let queryConditions = [
        eq(employees.userCode, codeStr),
        eq(employees.isActive, true)
      ];
      if (branchId) {
        queryConditions.push(eq(employees.branchId, branchId));
      }

      let [matchedEmp] = await db.select().from(employees).where(and(...queryConditions));

      // If not found in specific branch, check across all active employees in the system
      if (!matchedEmp) {
        const [fallbackEmp] = await db.select().from(employees).where(
          and(
            eq(employees.userCode, codeStr),
            eq(employees.isActive, true)
          )
        );
        matchedEmp = fallbackEmp;
      }

      if (!matchedEmp) {
        return res.status(401).json({ error: 'Invalid 4-digit security code. Employee not found.' });
      }

      // Fetch department links
      const allLinks = await db.select().from(employeeDepartments).where(eq(employeeDepartments.employeeId, matchedEmp.id));
      const allDepts = await db.select().from(departments);
      const deptMap = new Map(allDepts.map(d => [d.id, d]));

      const deptDetails = allLinks.map(l => ({
        ...l,
        department: deptMap.get(l.departmentId),
      }));

      // Check if employee belongs to this department (if departmentId specified)
      if (departmentId && deptDetails.length > 0) {
        const hasDept = deptDetails.some(l => l.departmentId === departmentId);
        if (!hasDept) {
          return res.status(403).json({
            error: `Employee ${matchedEmp.name} is not assigned to this department.`,
          });
        }
      }

      const fullEmployee = {
        id: matchedEmp.id,
        name: matchedEmp.name,
        employeeCode: matchedEmp.employeeCode,
        branchId: matchedEmp.branchId,
        userCode: matchedEmp.userCode,
        phone: matchedEmp.phone,
        email: matchedEmp.email,
        isActive: matchedEmp.isActive,
        departments: deptDetails,
        createdAt: matchedEmp.createdAt,
      };

      res.json({
        success: true,
        employee: fullEmployee,
      });
    } catch (error: any) {
      console.error('Error verifying employee punch code:', error);
      res.status(500).json({ error: error.message || 'Failed to verify employee code' });
    }
  };

  app.post('/api/employees/verify-pin', handleVerifyEmployeePin);
  app.post('/api/employee-punch-verify', handleVerifyEmployeePin);

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
        const { password: _, ...safeUser } = u;
        return {
          ...safeUser,
          hasPassword: Boolean(u.password),
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
      const { name, email, password, role, branchId, departmentId, userCode, isActive, assignedCategoryIds } = req.body;
      if (!name || !email || !role) {
        return res.status(400).json({ error: 'Name, email, and role are required' });
      }

      // Super Managers and System Admins do not require branch restriction
      const effectiveBranchId = (role === 'admin' || role === 'super_manager') ? null : (branchId ? parseInt(branchId) : null);
      const effectiveDeptId = (role === 'admin' || role === 'super_manager') ? null : (departmentId ? parseInt(departmentId) : null);

      const uid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const rawPassword = password && password.trim() ? password.trim() : 'welcome123';
      const [created] = await db.insert(users).values({
        uid,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashPassword(rawPassword),
        role: role || 'manager',
        branchId: effectiveBranchId,
        departmentId: effectiveDeptId,
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

      await logEntry(req, 'CREATE_USER', 'user', created.id, `Created ${role} user ${name} (${email}) with global or branch access`, effectiveBranchId || 1);
      const { password: _, ...safeCreated } = created;
      res.json(safeCreated);
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
      const { name, email, password, role, branchId, departmentId, userCode, isActive, assignedCategoryIds } = req.body;

      const isGlobalRole = role === 'admin' || role === 'super_manager';
      const effectiveBranchId = isGlobalRole ? null : (branchId !== undefined ? (branchId ? parseInt(branchId) : null) : undefined);
      const effectiveDeptId = isGlobalRole ? null : (departmentId !== undefined ? (departmentId ? parseInt(departmentId) : null) : undefined);

      const updateData: any = {
        name: name ? name.trim() : undefined,
        email: email ? email.trim().toLowerCase() : undefined,
        role: role || undefined,
        branchId: effectiveBranchId,
        departmentId: effectiveDeptId,
        userCode: userCode !== undefined ? userCode : undefined,
        isActive: isActive !== undefined ? !!isActive : undefined,
      };

      if (password && password.trim()) {
        updateData.password = hashPassword(password.trim());
      }

      const [updated] = await db.update(users)
        .set(updateData)
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

      await logEntry(req, 'UPDATE_USER', 'user', id, `Updated user ${updated.name} (${updated.role})`);
      const { password: _, ...safeUpdated } = updated;
      res.json(safeUpdated);
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

      // Fetch inventory items to calculate stock totals per model
      const allInventory = await db.select().from(inventoryItems);

      const enriched = modelList.map(m => {
        const modelItems = allInventory.filter(item => item.modelId === m.id);
        const totalQty = modelItems.reduce((acc, item) => acc + (item.totalQuantity || 0), 0);
        const availQty = modelItems.reduce((acc, item) => acc + (item.availableQuantity || 0), 0);
        const threshold = m.minThreshold !== undefined && m.minThreshold !== null ? m.minThreshold : 5;
        const isLow = modelItems.length > 0 && availQty <= threshold;

        // Auto-resolve field set: first by explicit m.fieldSetId, second by attached field set of category, third virtual category fields
        let resolvedFs = m.fieldSetId ? fsMap.get(m.fieldSetId) : null;
        if (!resolvedFs && m.categoryId) {
          resolvedFs = enrichedFieldSets.find(fs => fs.categoryId === m.categoryId) || null;
        }
        if (!resolvedFs && m.categoryId) {
          const catFields = allFields.filter(f => f.categoryId === m.categoryId);
          if (catFields.length > 0) {
            resolvedFs = {
              id: -m.categoryId,
              categoryId: m.categoryId,
              name: `${catMap.get(m.categoryId)?.name || 'Category'} Fields`,
              description: 'Custom fields automatically associated with category',
              fields: catFields,
              createdAt: new Date(),
            };
          }
        }

        return {
          ...m,
          minThreshold: threshold,
          totalStockQuantity: totalQty,
          availableStockQuantity: availQty,
          isLowStock: isLow,
          fieldSet: resolvedFs,
          category: catMap.get(m.categoryId),
        };
      });

      res.json(enriched);
    } catch (error: any) {
      console.error('Error fetching models:', error);
      res.status(500).json({ error: 'Failed to fetch models' });
    }
  });

  app.post('/api/models', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { categoryId, fieldSetId, name, modelNumber, minThreshold, manufacturer, description, imageUrl, customFieldsData } = req.body;
      if (!categoryId || !name || !modelNumber) {
        return res.status(400).json({ error: 'Category, name, and model number are required' });
      }

      // Automatically find field set attached to category if not explicitly provided
      let resolvedFieldSetId = fieldSetId ? parseInt(fieldSetId) : null;
      if (!resolvedFieldSetId && categoryId) {
        const matchingFs = await db.select().from(fieldSets).where(eq(fieldSets.categoryId, parseInt(categoryId))).limit(1);
        if (matchingFs.length > 0) {
          resolvedFieldSetId = matchingFs[0].id;
        }
      }

      const [created] = await db.insert(models).values({
        categoryId: parseInt(categoryId),
        fieldSetId: resolvedFieldSetId,
        name,
        modelNumber,
        minThreshold: minThreshold !== undefined && minThreshold !== null ? parseFloat(minThreshold) : 5,
        manufacturer: manufacturer || null,
        description: description || null,
        imageUrl: imageUrl || null,
        customFieldsData: customFieldsData || {},
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
      const { categoryId, fieldSetId, name, modelNumber, minThreshold, manufacturer, description, imageUrl, customFieldsData } = req.body;

      // Automatically find field set attached to category if fieldSetId is null/empty
      let resolvedFieldSetId = fieldSetId !== undefined ? (fieldSetId ? parseInt(fieldSetId) : null) : undefined;
      if (resolvedFieldSetId === null && categoryId) {
        const matchingFs = await db.select().from(fieldSets).where(eq(fieldSets.categoryId, parseInt(categoryId))).limit(1);
        if (matchingFs.length > 0) {
          resolvedFieldSetId = matchingFs[0].id;
        }
      }

      const [updated] = await db.update(models)
        .set({
          categoryId: categoryId ? parseInt(categoryId) : undefined,
          fieldSetId: resolvedFieldSetId,
          name: name || undefined,
          modelNumber: modelNumber || undefined,
          minThreshold: minThreshold !== undefined && minThreshold !== null ? parseFloat(minThreshold) : undefined,
          manufacturer: manufacturer !== undefined ? manufacturer : undefined,
          description: description !== undefined ? description : undefined,
          imageUrl: imageUrl !== undefined ? imageUrl : undefined,
          customFieldsData: customFieldsData !== undefined ? customFieldsData : undefined,
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

      // Fetch stock location breakdowns & lookup maps
      const allStockLocs = await db.select().from(stockLocations);
      const allCategories = await db.select().from(categories);
      const catMap = new Map(allCategories.map(c => [c.id, c]));
      const allModels = await db.select().from(models);
      const modelMap = new Map(allModels.map(m => [m.id, m]));
      const allVendors = await db.select().from(vendors);
      const vendorMap = new Map(allVendors.map(v => [v.id, v]));
      const allDepts = await db.select().from(departments);
      const deptMap = new Map(allDepts.map(d => [d.id, d]));
      const allLocations = await db.select().from(locations);
      const locMap = new Map(allLocations.map(l => [l.id, l]));
      const allMachines = await db.select().from(machines);
      const machMap = new Map(allMachines.map(m => [m.id, m]));
      const allBranches = await db.select().from(branches);
      const bMap = new Map(allBranches.map(b => [b.id, b]));
      const activeRepairsList = await db.select().from(vendorRepairs).where(eq(vendorRepairs.status, 'sent_to_vendor'));
      const activeRepairItemMap = new Map(activeRepairsList.map(r => [r.itemId, r]));

      // Function to format hierarchical location (e.g. Cupboard/Shelf1)
      const formatLocationName = (locId: number | null) => {
        if (!locId) return null;
        const loc = locMap.get(locId);
        if (!loc) return null;
        if (loc.parentLocationId) {
          const parent = locMap.get(loc.parentLocationId);
          return parent ? `${parent.name}/${loc.name}` : loc.name;
        }
        return loc.name;
      };

      // If branch filter applied, compute branch-specific quantities
      let enriched = items.map(item => {
        const rawLocs = allStockLocs.filter(l => l.itemId === item.id);
        const locs = rawLocs.map(sl => ({
          ...sl,
          branch: bMap.get(sl.branchId) || null,
          department: sl.departmentId ? deptMap.get(sl.departmentId) || null : null,
          location: sl.locationId ? {
            ...locMap.get(sl.locationId),
            formattedName: formatLocationName(sl.locationId)
          } : null,
          machine: sl.machineId ? machMap.get(sl.machineId) || null : null,
        }));

        const branchLocs = targetBranch ? locs.filter(l => l.branchId === targetBranch) : locs;
        const branchQty = branchLocs.reduce((acc, cur) => acc + cur.quantity, 0);

        const modelObj = item.modelId ? modelMap.get(item.modelId) : null;
        // Low stock threshold works based on model if item has model, otherwise item minThreshold
        let isLow = false;
        let effectiveThreshold = item.minThreshold;

        if (modelObj) {
          effectiveThreshold = modelObj.minThreshold !== undefined && modelObj.minThreshold !== null ? modelObj.minThreshold : 5;
          // Calculate aggregate available quantity for this model across all inventory items
          const modelItems = items.filter(i => i.modelId === modelObj.id);
          const totalModelAvailable = modelItems.reduce((acc, mi) => acc + (mi.availableQuantity || 0), 0);
          isLow = totalModelAvailable <= effectiveThreshold;
        } else {
          isLow = item.availableQuantity <= item.minThreshold;
        }

        const activeRepairTicket = activeRepairItemMap.get(item.id);
        const effectiveStatus = activeRepairTicket ? 'in_repair' : item.status;

        return {
          ...item,
          status: effectiveStatus,
          minThreshold: effectiveThreshold,
          branchQuantity: targetBranch ? branchQty : item.availableQuantity,
          category: catMap.get(item.categoryId),
          model: modelObj ? { ...modelObj, minThreshold: effectiveThreshold } : null,
          supplier: item.supplierId ? vendorMap.get(item.supplierId) : null,
          isLowStock: isLow,
          stockLocations: locs,
        };
      });

      // If a specific branch is selected, filter to items with available stock in that branch or in repair
      if (targetBranch && all !== 'true') {
        enriched = enriched.filter(item => {
          if (item.status === 'trashed') return false;
          if ((item.branchQuantity || 0) > 0) return true;
          // Items in repair belonging to this branch should be visible in assets list
          if (item.status === 'in_repair') {
            const rawLocs = allStockLocs.filter(l => l.itemId === item.id);
            if (rawLocs.some(l => l.branchId === targetBranch)) return true;
            const activeRepair = activeRepairItemMap.get(item.id);
            if (activeRepair && activeRepair.branchId === targetBranch) return true;
          }
          return false;
        });
      }

      // Department login: only items with available stock > 0 and not trashed (or in repair)
      if (req.user?.role === 'department') {
        enriched = enriched.filter(item => ((item.branchQuantity || 0) > 0 || item.status === 'in_repair') && item.status !== 'trashed');
      }

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
      } = req.body;

      if (!code || !name || !itemType || !categoryId || !uom) {
        return res.status(400).json({ error: 'Code, name, itemType, category, and UOM are required' });
      }

      const finalCode = (code || '').trim().toUpperCase();

      // Check for duplicate SKU code (all caps, unique)
      const existing = await db.select().from(inventoryItems).where(eq(inventoryItems.code, finalCode));
      if (existing.length > 0) {
        return res.status(400).json({ error: `SKU / Item Code "${finalCode}" already exists. Duplicate SKUs are not allowed.` });
      }

      // Assets always have quantity = 1; Consumables can have multiple quantities
      const isAsset = itemType === 'asset';
      const qty = isAsset ? 1 : (parseFloat(quantity) || 1);

      // Check category permission
      const allowedCatIds = await getPermittedCategoryIdsForUser(req);
      if (allowedCatIds !== null && !allowedCatIds.includes(parseInt(categoryId))) {
        return res.status(403).json({ error: 'Access Denied: You do not have permission to add items to this category.' });
      }

      // Determine threshold from model if available
      let threshold = minThreshold ? parseFloat(minThreshold) : 5;
      if (modelId) {
        const [modelRecord] = await db.select().from(models).where(eq(models.id, parseInt(modelId)));
        if (modelRecord && modelRecord.minThreshold !== undefined && modelRecord.minThreshold !== null) {
          threshold = modelRecord.minThreshold;
        }
      }

      const bId = branchId ? parseInt(branchId) : (req.user?.branchId || 12);

      const [created] = await db.insert(inventoryItems).values({
        code: finalCode,
        name: name.trim(),
        itemType,
        categoryId: parseInt(categoryId),
        modelId: modelId ? parseInt(modelId) : null,
        supplierId: supplierId ? parseInt(supplierId) : null,
        uom,
        totalQuantity: qty,
        availableQuantity: qty,
        minThreshold: threshold,
        recordDate: recordDate || new Date().toISOString().split('T')[0],
        status: 'available',
        customFieldsData: customFieldsData || {},
        imageUrl: imageUrl || null,
        notes: notes || null,
        engagementStatus: isAsset ? 'idle' : null,
      }).returning();

      // Create initial stock location (Machines are assigned via Record Stock Transfer & Allocation)
      await db.insert(stockLocations).values({
        itemId: created.id,
        branchId: bId,
        departmentId: departmentId ? parseInt(departmentId) : null,
        locationId: locationId ? parseInt(locationId) : null,
        machineId: null,
        quantity: qty,
      });

      await logEntry(req, 'CREATE_INVENTORY_ITEM', 'inventory', created.id, `Created ${itemType}: ${name} (${finalCode}) with ${qty} ${uom}`, bId);
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

      const finalCode = code !== undefined ? (code || '').trim().toUpperCase() : undefined;

      // Duplicate check for SKU
      if (finalCode) {
        const existing = await db.select().from(inventoryItems).where(eq(inventoryItems.code, finalCode));
        if (existing.length > 0 && existing[0].id !== id) {
          return res.status(400).json({ error: `SKU / Item Code "${finalCode}" is already in use by another item. Duplicate SKUs are not allowed.` });
        }
      }

      const [existingItem] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
      if (!existingItem) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const allowedCatIds = await getPermittedCategoryIdsForUser(req);
      if (allowedCatIds !== null) {
        if (!allowedCatIds.includes(existingItem.categoryId)) {
          return res.status(403).json({ error: 'Access Denied: You do not have permission to manage items in this category.' });
        }
        if (categoryId && !allowedCatIds.includes(parseInt(categoryId))) {
          return res.status(403).json({ error: 'Access Denied: You do not have permission to move item into this category.' });
        }
      }

      // Editing existing item should not allow fieldset values to be edited directly.
      // Change of model is allowed; if model changes, adopt the new model's fieldset data.
      let effectiveCustomFieldsData = existingItem.customFieldsData;
      const targetModelId = modelId !== undefined ? (modelId ? parseInt(modelId) : null) : existingItem.modelId;
      if (targetModelId !== existingItem.modelId) {
        if (targetModelId) {
          const [newModel] = await db.select().from(models).where(eq(models.id, targetModelId));
          effectiveCustomFieldsData = (newModel?.customFieldsData as Record<string, any>) || {};
        } else {
          effectiveCustomFieldsData = {};
        }
      }

      const [updated] = await db.update(inventoryItems)
        .set({
          code: finalCode,
          name: name ? name.trim() : undefined,
          itemType: itemType || undefined,
          categoryId: categoryId ? parseInt(categoryId) : undefined,
          modelId: modelId !== undefined ? (modelId ? parseInt(modelId) : null) : undefined,
          supplierId: supplierId !== undefined ? (supplierId ? parseInt(supplierId) : null) : undefined,
          uom: uom || undefined,
          totalQuantity: totalQuantity !== undefined ? parseFloat(totalQuantity) : undefined,
          availableQuantity: availableQuantity !== undefined ? parseFloat(availableQuantity) : undefined,
          minThreshold: minThreshold !== undefined ? parseFloat(minThreshold) : undefined,
          recordDate: recordDate || undefined,
          customFieldsData: effectiveCustomFieldsData,
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
  // Pending branch transfers awaiting acceptance
  app.get('/api/movements/pending', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, all } = req.query;
      const allowedCatIds = all === 'true' ? null : await getPermittedCategoryIdsForUser(req);

      let movs = await db.select().from(inventoryMovements)
        .where(eq(inventoryMovements.status, 'pending_acceptance'))
        .orderBy(desc(inventoryMovements.createdAt));

      if (branchId) {
        const b = parseInt(branchId as string);
        // Pending transfer where destination is this branch
        movs = movs.filter(m => m.toBranchId === b);
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
      console.error('Error fetching pending movements:', error);
      res.status(500).json({ error: 'Failed to fetch pending movements' });
    }
  });

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

      if (!itemId || !fromBranchId || !toBranchId) {
        return res.status(400).json({ error: 'Item, fromBranch, and toBranch are required' });
      }

      const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, parseInt(itemId)));
      if (!item) return res.status(404).json({ error: 'Item not found' });

      // Assets always move as 1 unit
      const isAsset = item.itemType === 'asset';
      const qty = isAsset ? 1 : (parseFloat(quantity) || 1);

      // Deduct from exact source stock location
      let sourceLoc = null;
      if (fromLocationId) {
        const matchingLocs = await db.select().from(stockLocations).where(
          and(
            eq(stockLocations.itemId, item.id),
            eq(stockLocations.branchId, parseInt(fromBranchId)),
            eq(stockLocations.locationId, parseInt(fromLocationId)),
            fromDepartmentId ? eq(stockLocations.departmentId, parseInt(fromDepartmentId)) : sql`1=1`
          )
        );
        sourceLoc = matchingLocs.find(l => l.quantity >= qty) || matchingLocs[0];
      }

      if (!sourceLoc && fromDepartmentId) {
        const deptLocs = await db.select().from(stockLocations).where(
          and(
            eq(stockLocations.itemId, item.id),
            eq(stockLocations.branchId, parseInt(fromBranchId)),
            eq(stockLocations.departmentId, parseInt(fromDepartmentId))
          )
        );
        sourceLoc = deptLocs.find(l => l.quantity >= qty) || deptLocs[0];
      }

      if (!sourceLoc) {
        const anyBranchLoc = await db.select().from(stockLocations).where(
          and(
            eq(stockLocations.itemId, item.id),
            eq(stockLocations.branchId, parseInt(fromBranchId))
          )
        );
        sourceLoc = anyBranchLoc.find(l => l.quantity >= qty) || anyBranchLoc[0];
      }

      if (sourceLoc) {
        await db.update(stockLocations)
          .set({ quantity: Math.max(0, sourceLoc.quantity - qty) })
          .where(eq(stockLocations.id, sourceLoc.id));
      }

      const fromB = parseInt(String(fromBranchId));
      const toB = parseInt(String(toBranchId));

      if (movementType === 'branch_to_branch' && fromB === toB) {
        return res.status(400).json({ error: 'Destination branch must be different from source branch for inter-branch transfers.' });
      }

      const isInterBranch = (movementType === 'branch_to_branch') && (fromB !== toB);
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
      const rawDept = req.body.targetDepartmentId || req.body.departmentId;
      const rawLoc = req.body.targetLocationId || req.body.locationId;
      const rawMch = req.body.targetMachineId || req.body.machineId;
      const departmentId = rawDept ? parseInt(rawDept) : undefined;
      const locationId = rawLoc ? parseInt(rawLoc) : undefined;
      const machineId = rawMch ? parseInt(rawMch) : undefined;
      const notes = req.body.notes;

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
          departmentId ? eq(stockLocations.departmentId, departmentId) : sql`1=1`,
          locationId ? eq(stockLocations.locationId, locationId) : sql`1=1`,
          machineId ? eq(stockLocations.machineId, machineId) : sql`1=1`
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
          departmentId: departmentId || null,
          locationId: locationId || null,
          machineId: machineId || null,
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
          toDepartmentId: departmentId || null,
          toLocationId: locationId || null,
          toMachineId: machineId || null,
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

  app.delete('/api/movements/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(inventoryMovements).where(eq(inventoryMovements.id, id));
      await logEntry(req, 'DELETE_MOVEMENT', 'movement', id, `Deleted movement log #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting movement:', error);
      res.status(500).json({ error: error.message || 'Failed to delete movement' });
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
        employeeId,
        securityPinEntered,
        branchId,
        departmentId,
        itemId,
        requestedQty,
        reasonId,
        reasonText,
        machineId,
      } = req.body;

      if (!branchId || !departmentId || !itemId || !requestedQty || !reasonText) {
        return res.status(400).json({ error: 'Branch, department, item, quantity, and reason are required' });
      }

      let emp: any = null;
      if (employeeId) {
        const [foundEmp] = await db.select().from(employees).where(
          and(
            eq(employees.id, parseInt(employeeId)),
            eq(employees.isActive, true)
          )
        );
        emp = foundEmp;
      } else if (securityPinEntered && securityPinEntered.length === 4) {
        const [foundEmp] = await db.select().from(employees).where(
          and(
            eq(employees.userCode, securityPinEntered),
            eq(employees.isActive, true)
          )
        );
        emp = foundEmp;
      }

      if (!emp) {
        return res.status(401).json({ error: 'Employee verification failed. Please select an active employee or verify your PIN.' });
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

      const parsedItemId = parseInt(String(itemId));
      const parsedVendorId = parseInt(String(vendorId));

      if (isNaN(parsedItemId) || isNaN(parsedVendorId)) {
        return res.status(400).json({ error: 'Invalid Item ID or Vendor ID' });
      }

      const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, parsedItemId));
      if (!item) return res.status(404).json({ error: 'Target asset was not found' });

      // Check if already in repair
      if (item.status === 'in_repair') {
        return res.status(400).json({ error: `Asset "${item.name}" (${item.code}) is already in repair at a vendor.` });
      }

      // Calculate how long asset was engaged before repair
      let engagementMinutes = item.totalEngagementMinutes || 0;
      if (item.lastEngagedAt) {
        const now = new Date().getTime();
        const start = new Date(item.lastEngagedAt).getTime();
        const diffMinutes = Math.max(0, Math.floor((now - start) / 60000));
        engagementMinutes += diffMinutes;
      }

      // Find item's current active stock location with quantity > 0
      const allItemLocs = await db.select().from(stockLocations).where(eq(stockLocations.itemId, item.id));
      const activeLoc = allItemLocs.find(l => l.quantity > 0) || allItemLocs[0];
      const bId = (branchId && !isNaN(parseInt(String(branchId)))) 
        ? parseInt(String(branchId)) 
        : (activeLoc?.branchId || req.user?.branchId || 12);
      const safeBranchId = !isNaN(bId) && bId > 0 ? bId : 12;

      const [created] = await db.insert(vendorRepairs).values({
        itemId: item.id,
        vendorId: parsedVendorId,
        branchId: safeBranchId,
        sentDate: sentDate || new Date().toISOString().split('T')[0],
        expectedReturnDate: expectedReturnDate || null,
        issueDescription: String(issueDescription).trim(),
        repairCost: repairCost ? parseFloat(String(repairCost)) : 0,
        status: 'sent_to_vendor',
        engagedDurationMinutes: engagementMinutes,
        managerNotes: managerNotes || null,
      }).returning();

      // Update asset status and quantity
      await db.update(inventoryItems).set({
        status: 'in_repair',
        availableQuantity: 0,
        engagementStatus: 'idle',
        totalEngagementMinutes: engagementMinutes,
      }).where(eq(inventoryItems.id, item.id));

      if (activeLoc) {
        await db.update(stockLocations).set({
          quantity: Math.max(0, activeLoc.quantity - 1),
        }).where(eq(stockLocations.id, activeLoc.id));
      }

      // Record movement to vendor
      await db.insert(inventoryMovements).values({
        itemId: item.id,
        quantity: 1,
        uom: item.uom || 'unit',
        movementType: 'sent_to_vendor',
        status: 'completed',
        fromBranchId: safeBranchId,
        toBranchId: safeBranchId,
        movedByUserId: req.user?.id || 1,
        notes: `Asset sent to vendor for repair: ${issueDescription}. Engaged duration: ${Math.floor(engagementMinutes / 60)}h`,
      });

      await logEntry(req, 'SEND_TO_VENDOR_REPAIR', 'repair', created.id, `Sent ${item.name} (${item.code}) to vendor #${parsedVendorId}. Logged engagement: ${Math.floor(engagementMinutes / 60)} hours`, safeBranchId);
      res.json(created);
    } catch (error: any) {
      console.error('Error creating repair record:', error);
      res.status(500).json({ error: error.message || 'Failed to send asset for repair' });
    }
  });

  const handleReturnRepair = async (req: AuthRequest, res: any) => {
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
        availableQuantity: 1,
        engagementStatus: 'idle',
      }).where(eq(inventoryItems.id, repair.itemId));

      // Update location or restore stock location
      const destDept = departmentId ? parseInt(departmentId) : null;
      const destLoc = locationId ? parseInt(locationId) : null;

      const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, repair.itemId));
      if (item) {
        const destStockLocs = await db.select().from(stockLocations).where(
          and(
            eq(stockLocations.itemId, item.id),
            eq(stockLocations.branchId, repair.branchId),
            destDept ? eq(stockLocations.departmentId, destDept) : sql`1=1`
          )
        );

        if (destStockLocs.length > 0) {
          await db.update(stockLocations).set({
            quantity: destStockLocs[0].quantity + 1,
            locationId: destLoc || destStockLocs[0].locationId,
          }).where(eq(stockLocations.id, destStockLocs[0].id));
        } else {
          await db.insert(stockLocations).values({
            itemId: item.id,
            branchId: repair.branchId,
            departmentId: destDept,
            locationId: destLoc,
            quantity: 1,
          });
        }

        await db.insert(inventoryMovements).values({
          itemId: item.id,
          quantity: 1,
          uom: item.uom,
          movementType: 'returned_from_vendor',
          status: 'completed',
          fromBranchId: repair.branchId,
          toBranchId: repair.branchId,
          toDepartmentId: destDept,
          toLocationId: destLoc,
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
  };

  app.post('/api/repairs/:id/return', authMiddleware, handleReturnRepair);
  app.patch('/api/repairs/:id/return', authMiddleware, handleReturnRepair);

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

  // ==========================================
  // PREVENTIVE MAINTENANCE API ROUTES
  // ==========================================

  function computeNextDueDate(baseDateStr: string, freqType: string, interval: number = 1): string {
    const d = new Date(baseDateStr + 'T00:00:00');
    const count = Math.max(1, interval || 1);
    switch (freqType) {
      case 'daily':
        d.setDate(d.getDate() + count);
        break;
      case 'weekly':
        d.setDate(d.getDate() + (7 * count));
        break;
      case 'biweekly':
        d.setDate(d.getDate() + (14 * count));
        break;
      case 'monthly':
        d.setMonth(d.getMonth() + count);
        break;
      case 'quarterly':
        d.setMonth(d.getMonth() + (3 * count));
        break;
      case 'semi_annually':
        d.setMonth(d.getMonth() + (6 * count));
        break;
      case 'annually':
        d.setFullYear(d.getFullYear() + count);
        break;
      case 'custom_days':
      default:
        d.setDate(d.getDate() + count);
        break;
    }
    return d.toISOString().split('T')[0];
  }

  // 1. PM Master Plans (Admin & Super Manager can create/edit, all can view)
  app.get('/api/pm/plans', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const allPlans = await db.select().from(pmPlans).orderBy(pmPlans.code);
      const allSchedules = await db.select().from(pmSchedules);
      
      const enriched = allPlans.map((plan) => {
        const schedCount = allSchedules.filter((s) => s.planId === plan.id && s.status === 'active').length;
        return {
          ...plan,
          schedulesCount: schedCount,
        };
      });

      res.json(enriched);
    } catch (error: any) {
      console.error('Error fetching PM plans:', error);
      res.status(500).json({ error: 'Failed to fetch PM master plans' });
    }
  });

  app.get('/api/pm/plans/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const planId = parseInt(req.params.id);
      const [plan] = await db.select().from(pmPlans).where(eq(pmPlans.id, planId));
      if (!plan) return res.status(404).json({ error: 'PM plan not found' });
      res.json(plan);
    } catch (error: any) {
      console.error('Error fetching PM plan:', error);
      res.status(500).json({ error: 'Failed to fetch PM plan' });
    }
  });

  app.post('/api/pm/plans', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'super_manager') {
        return res.status(403).json({
          error: 'Access Denied: Only Administrator and Super Manager roles can create master PM plans.',
        });
      }

      const {
        code,
        title,
        description,
        category,
        frequencyType,
        frequencyInterval,
        estimatedDurationMinutes,
        priority,
        machineCategory,
        checklistTemplate,
        requiredPartsTemplate,
        safetyNotes,
        isActive,
      } = req.body;

      if (!title || !frequencyType) {
        return res.status(400).json({ error: 'Title and frequency type are required' });
      }

      // Auto-generate code if missing
      const planCode = code || `PM-${category ? category.substring(0, 3).toUpperCase() : 'GEN'}-${Date.now().toString().slice(-4)}`;

      const [created] = await db.insert(pmPlans).values({
        code: planCode,
        title,
        description: description || null,
        category: category || 'General Maintenance',
        frequencyType: frequencyType || 'monthly',
        frequencyInterval: frequencyInterval ? parseInt(frequencyInterval) : 1,
        estimatedDurationMinutes: estimatedDurationMinutes ? parseInt(estimatedDurationMinutes) : 60,
        priority: priority || 'medium',
        machineCategory: machineCategory || null,
        checklistTemplate: checklistTemplate || [],
        requiredPartsTemplate: requiredPartsTemplate || [],
        safetyNotes: safetyNotes || null,
        isActive: isActive !== false,
        createdById: req.user?.id || 1,
      }).returning();

      await logEntry(req, 'CREATE_PM_PLAN', 'pm_plan', created.id, `Created PM master plan "${created.title}" (${created.code})`);
      res.json(created);
    } catch (error: any) {
      console.error('Error creating PM plan:', error);
      res.status(500).json({ error: error.message || 'Failed to create PM plan' });
    }
  });

  app.put('/api/pm/plans/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'super_manager') {
        return res.status(403).json({
          error: 'Access Denied: Only Administrator and Super Manager roles can update master PM plans.',
        });
      }

      const planId = parseInt(req.params.id);
      const {
        code,
        title,
        description,
        category,
        frequencyType,
        frequencyInterval,
        estimatedDurationMinutes,
        priority,
        machineCategory,
        checklistTemplate,
        requiredPartsTemplate,
        safetyNotes,
        isActive,
      } = req.body;

      const [updated] = await db.update(pmPlans).set({
        code: code || undefined,
        title: title || undefined,
        description: description !== undefined ? description : undefined,
        category: category || undefined,
        frequencyType: frequencyType || undefined,
        frequencyInterval: frequencyInterval ? parseInt(frequencyInterval) : undefined,
        estimatedDurationMinutes: estimatedDurationMinutes ? parseInt(estimatedDurationMinutes) : undefined,
        priority: priority || undefined,
        machineCategory: machineCategory !== undefined ? machineCategory : undefined,
        checklistTemplate: checklistTemplate !== undefined ? checklistTemplate : undefined,
        requiredPartsTemplate: requiredPartsTemplate !== undefined ? requiredPartsTemplate : undefined,
        safetyNotes: safetyNotes !== undefined ? safetyNotes : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        updatedAt: new Date(),
      }).where(eq(pmPlans.id, planId)).returning();

      if (!updated) return res.status(404).json({ error: 'PM plan not found' });

      await logEntry(req, 'UPDATE_PM_PLAN', 'pm_plan', planId, `Updated PM master plan "${updated.title}" (${updated.code})`);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating PM plan:', error);
      res.status(500).json({ error: error.message || 'Failed to update PM plan' });
    }
  });

  app.delete('/api/pm/plans/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'super_manager') {
        return res.status(403).json({
          error: 'Access Denied: Only Administrator and Super Manager roles can delete master PM plans.',
        });
      }

      const planId = parseInt(req.params.id);
      const [plan] = await db.select().from(pmPlans).where(eq(pmPlans.id, planId));
      if (!plan) return res.status(404).json({ error: 'PM plan not found' });

      // Clean up linked work orders and schedules
      await db.delete(pmWorkOrders).where(eq(pmWorkOrders.planId, planId));
      await db.delete(pmSchedules).where(eq(pmSchedules.planId, planId));
      await db.delete(pmPlans).where(eq(pmPlans.id, planId));

      await logEntry(req, 'DELETE_PM_PLAN', 'pm_plan', planId, `Deleted PM master plan "${plan.title}" (${plan.code})`);
      res.json({ success: true, message: 'PM plan and associated schedules removed' });
    } catch (error: any) {
      console.error('Error deleting PM plan:', error);
      res.status(500).json({ error: error.message || 'Failed to delete PM plan' });
    }
  });

  // 2. PM Recurring Schedules (Admin & Super Manager can assign schedules)
  app.get('/api/pm/schedules', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, departmentId, machineId, status } = req.query;

      const [allSchedules, allPlans, allMachines, allBranches, allDepts, allEmployees, allWorkOrders] = await Promise.all([
        db.select().from(pmSchedules).orderBy(pmSchedules.nextDueDate),
        db.select().from(pmPlans),
        db.select().from(machines),
        db.select().from(branches),
        db.select().from(departments),
        db.select().from(employees),
        db.select().from(pmWorkOrders),
      ]);

      const planMap = new Map(allPlans.map((p) => [p.id, p]));
      const machineMap = new Map(allMachines.map((m) => [m.id, m]));
      const branchMap = new Map(allBranches.map((b) => [b.id, b]));
      const deptMap = new Map(allDepts.map((d) => [d.id, d]));
      const empMap = new Map(allEmployees.map((e) => [e.id, e]));

      let filtered = allSchedules;

      // Role and parameter scoping
      if (req.user?.role === 'manager' || req.user?.role === 'department') {
        const uBranch = req.user.branchId || 1;
        filtered = filtered.filter((s) => s.branchId === uBranch);
        if (req.user.departmentId) {
          filtered = filtered.filter((s) => s.departmentId === req.user?.departmentId);
        }
      } else if (branchId) {
        filtered = filtered.filter((s) => s.branchId === parseInt(branchId as string));
      }

      if (departmentId) {
        filtered = filtered.filter((s) => s.departmentId === parseInt(departmentId as string));
      }
      if (machineId) {
        filtered = filtered.filter((s) => s.machineId === parseInt(machineId as string));
      }
      if (status) {
        filtered = filtered.filter((s) => s.status === status);
      }

      const today = new Date().toISOString().split('T')[0];

      const enriched = filtered.map((sched) => {
        const activeWO = allWorkOrders.find(
          (wo) => wo.scheduleId === sched.id && (wo.status === 'scheduled' || wo.status === 'in_progress')
        );

        const dueMs = new Date(sched.nextDueDate + 'T00:00:00').getTime();
        const nowMs = new Date(today + 'T00:00:00').getTime();
        const daysUntilDue = Math.round((dueMs - nowMs) / (86400000));
        const isOverdue = daysUntilDue < 0 && sched.status === 'active';

        return {
          ...sched,
          plan: planMap.get(sched.planId),
          machine: machineMap.get(sched.machineId),
          branch: branchMap.get(sched.branchId),
          department: deptMap.get(sched.departmentId),
          assignedEmployee: sched.assignedEmployeeId ? empMap.get(sched.assignedEmployeeId) : null,
          activeWorkOrder: activeWO || null,
          daysUntilDue,
          isOverdue,
        };
      });

      res.json(enriched);
    } catch (error: any) {
      console.error('Error fetching PM schedules:', error);
      res.status(500).json({ error: 'Failed to fetch PM schedules' });
    }
  });

  app.post('/api/pm/schedules', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'super_manager') {
        return res.status(403).json({
          error: 'Access Denied: Only Administrator and Super Manager roles can assign PM recurring schedules.',
        });
      }

      const {
        planId,
        machineId,
        branchId,
        departmentId,
        assignedEmployeeId,
        scheduleType,
        frequencyType,
        frequencyInterval,
        startDate,
        nextDueDate,
        autoGenerateDaysInAdvance,
        notes,
      } = req.body;

      if (!planId || !machineId) {
        return res.status(400).json({ error: 'Plan and Machine selection are required' });
      }

      const [plan] = await db.select().from(pmPlans).where(eq(pmPlans.id, parseInt(planId)));
      if (!plan) return res.status(404).json({ error: 'Plan not found' });

      const [machine] = await db.select().from(machines).where(eq(machines.id, parseInt(machineId)));
      if (!machine) return res.status(404).json({ error: 'Machine not found' });

      const bId = branchId ? parseInt(branchId) : machine.branchId;
      const dId = departmentId ? parseInt(departmentId) : machine.departmentId;
      const sDate = startDate || new Date().toISOString().split('T')[0];
      const fType = frequencyType || plan.frequencyType || 'monthly';
      const fInterval = frequencyInterval ? parseInt(frequencyInterval) : (plan.frequencyInterval || 1);
      const nDue = nextDueDate || sDate;

      const [created] = await db.insert(pmSchedules).values({
        planId: plan.id,
        machineId: machine.id,
        branchId: bId,
        departmentId: dId,
        assignedEmployeeId: assignedEmployeeId ? parseInt(assignedEmployeeId) : null,
        scheduleType: scheduleType || 'fixed_calendar',
        frequencyType: fType,
        frequencyInterval: fInterval,
        startDate: sDate,
        nextDueDate: nDue,
        status: 'active',
        autoGenerateDaysInAdvance: autoGenerateDaysInAdvance ? parseInt(autoGenerateDaysInAdvance) : 7,
        notes: notes || null,
      }).returning();

      // Automatically spawn initial active work order for this schedule
      const woNum = `WO-PM-${Date.now().toString().slice(-6)}`;
      await db.insert(pmWorkOrders).values({
        workOrderNumber: woNum,
        scheduleId: created.id,
        planId: plan.id,
        machineId: machine.id,
        branchId: bId,
        departmentId: dId,
        title: `${machine.machineCode} - ${plan.title}`,
        dueDate: nDue,
        priority: plan.priority || 'medium',
        status: 'scheduled',
        assignedEmployeeId: assignedEmployeeId ? parseInt(assignedEmployeeId) : null,
        checklistResults: (plan.checklistTemplate as any[] || []).map((t) => ({
          taskId: t.id,
          task: t.task,
          type: t.type,
          status: 'pass',
          notes: '',
        })),
        partsConsumed: [],
      });

      await logEntry(req, 'ASSIGN_PM_SCHEDULE', 'pm_schedule', created.id, `Assigned PM schedule "${plan.title}" to machine ${machine.name} (${machine.machineCode})`, bId);
      res.json(created);
    } catch (error: any) {
      console.error('Error creating PM schedule:', error);
      res.status(500).json({ error: error.message || 'Failed to create PM schedule' });
    }
  });

  app.put('/api/pm/schedules/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'super_manager') {
        return res.status(403).json({
          error: 'Access Denied: Only Administrator and Super Manager roles can edit PM schedules.',
        });
      }

      const scheduleId = parseInt(req.params.id);
      const {
        assignedEmployeeId,
        scheduleType,
        frequencyType,
        frequencyInterval,
        nextDueDate,
        status,
        autoGenerateDaysInAdvance,
        notes,
      } = req.body;

      const [updated] = await db.update(pmSchedules).set({
        assignedEmployeeId: assignedEmployeeId !== undefined ? (assignedEmployeeId ? parseInt(assignedEmployeeId) : null) : undefined,
        scheduleType: scheduleType || undefined,
        frequencyType: frequencyType || undefined,
        frequencyInterval: frequencyInterval ? parseInt(frequencyInterval) : undefined,
        nextDueDate: nextDueDate || undefined,
        status: status || undefined,
        autoGenerateDaysInAdvance: autoGenerateDaysInAdvance ? parseInt(autoGenerateDaysInAdvance) : undefined,
        notes: notes !== undefined ? notes : undefined,
        updatedAt: new Date(),
      }).where(eq(pmSchedules.id, scheduleId)).returning();

      if (!updated) return res.status(404).json({ error: 'Schedule not found' });

      await logEntry(req, 'UPDATE_PM_SCHEDULE', 'pm_schedule', scheduleId, `Updated PM schedule #${scheduleId}`);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating PM schedule:', error);
      res.status(500).json({ error: error.message || 'Failed to update PM schedule' });
    }
  });

  app.delete('/api/pm/schedules/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'super_manager') {
        return res.status(403).json({
          error: 'Access Denied: Only Administrator and Super Manager roles can remove PM schedules.',
        });
      }

      const scheduleId = parseInt(req.params.id);
      await db.delete(pmWorkOrders).where(eq(pmWorkOrders.scheduleId, scheduleId));
      await db.delete(pmSchedules).where(eq(pmSchedules.id, scheduleId));

      await logEntry(req, 'DELETE_PM_SCHEDULE', 'pm_schedule', scheduleId, `Deleted PM schedule #${scheduleId}`);
      res.json({ success: true, message: 'PM schedule and linked active work orders removed' });
    } catch (error: any) {
      console.error('Error deleting PM schedule:', error);
      res.status(500).json({ error: error.message || 'Failed to delete PM schedule' });
    }
  });

  // 3. PM Work Orders / Checklists Queue
  app.get('/api/pm/work-orders', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, departmentId, machineId, status, priority, dueRange } = req.query;

      const [allWorkOrders, allPlans, allMachines, allBranches, allDepts, allEmployees] = await Promise.all([
        db.select().from(pmWorkOrders).orderBy(desc(pmWorkOrders.dueDate)),
        db.select().from(pmPlans),
        db.select().from(machines),
        db.select().from(branches),
        db.select().from(departments),
        db.select().from(employees),
      ]);

      const planMap = new Map(allPlans.map((p) => [p.id, p]));
      const machineMap = new Map(allMachines.map((m) => [m.id, m]));
      const branchMap = new Map(allBranches.map((b) => [b.id, b]));
      const deptMap = new Map(allDepts.map((d) => [d.id, d]));
      const empMap = new Map(allEmployees.map((e) => [e.id, e]));

      let filtered = allWorkOrders;

      // Scoping by user role
      if (req.user?.role === 'manager' || req.user?.role === 'department') {
        const uBranch = req.user.branchId || 1;
        filtered = filtered.filter((wo) => wo.branchId === uBranch);
        if (req.user.departmentId) {
          filtered = filtered.filter((wo) => wo.departmentId === req.user?.departmentId);
        }
      } else if (branchId) {
        filtered = filtered.filter((wo) => wo.branchId === parseInt(branchId as string));
      }

      if (departmentId) {
        filtered = filtered.filter((wo) => wo.departmentId === parseInt(departmentId as string));
      }
      if (machineId) {
        filtered = filtered.filter((wo) => wo.machineId === parseInt(machineId as string));
      }
      if (status) {
        filtered = filtered.filter((wo) => wo.status === status);
      }
      if (priority) {
        filtered = filtered.filter((wo) => wo.priority === priority);
      }

      const today = new Date().toISOString().split('T')[0];

      if (dueRange === 'overdue') {
        filtered = filtered.filter((wo) => wo.dueDate < today && (wo.status === 'scheduled' || wo.status === 'in_progress'));
      } else if (dueRange === 'today') {
        filtered = filtered.filter((wo) => wo.dueDate === today);
      } else if (dueRange === 'next7days') {
        const in7Days = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];
        filtered = filtered.filter((wo) => wo.dueDate >= today && wo.dueDate <= in7Days);
      }

      const enriched = filtered.map((wo) => {
        const dueMs = new Date(wo.dueDate + 'T00:00:00').getTime();
        const nowMs = new Date(today + 'T00:00:00').getTime();
        const daysUntilDue = Math.round((dueMs - nowMs) / (86400000));
        const isOverdue = daysUntilDue < 0 && (wo.status === 'scheduled' || wo.status === 'in_progress');

        return {
          ...wo,
          plan: planMap.get(wo.planId),
          machine: machineMap.get(wo.machineId),
          branch: branchMap.get(wo.branchId),
          department: deptMap.get(wo.departmentId),
          assignedEmployee: wo.assignedEmployeeId ? empMap.get(wo.assignedEmployeeId) : null,
          daysUntilDue,
          isOverdue,
        };
      });

      res.json(enriched);
    } catch (error: any) {
      console.error('Error fetching PM work orders:', error);
      res.status(500).json({ error: 'Failed to fetch PM work orders' });
    }
  });

  app.get('/api/pm/work-orders/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const woId = parseInt(req.params.id);
      const [wo] = await db.select().from(pmWorkOrders).where(eq(pmWorkOrders.id, woId));
      if (!wo) return res.status(404).json({ error: 'Work order not found' });

      const [plan] = await db.select().from(pmPlans).where(eq(pmPlans.id, wo.planId));
      const [machine] = await db.select().from(machines).where(eq(machines.id, wo.machineId));
      const [branch] = await db.select().from(branches).where(eq(branches.id, wo.branchId));
      const [dept] = await db.select().from(departments).where(eq(departments.id, wo.departmentId));
      const [emp] = wo.assignedEmployeeId ? await db.select().from(employees).where(eq(employees.id, wo.assignedEmployeeId)) : [null];

      res.json({
        ...wo,
        plan,
        machine,
        branch,
        department: dept,
        assignedEmployee: emp,
      });
    } catch (error: any) {
      console.error('Error fetching work order:', error);
      res.status(500).json({ error: 'Failed to fetch work order' });
    }
  });

  // Auto-generate upcoming due work orders from active schedules
  app.post('/api/pm/work-orders/generate-due', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const allSchedules = await db.select().from(pmSchedules).where(eq(pmSchedules.status, 'active'));
      const allPlans = await db.select().from(pmPlans);
      const allMachines = await db.select().from(machines);
      const existingWorkOrders = await db.select().from(pmWorkOrders);

      const planMap = new Map(allPlans.map((p) => [p.id, p]));
      const machineMap = new Map(allMachines.map((m) => [m.id, m]));

      const today = new Date();
      let createdCount = 0;

      for (const sched of allSchedules) {
        const leadDays = sched.autoGenerateDaysInAdvance || 7;
        const horizon = new Date(today.getTime() + 86400000 * leadDays).toISOString().split('T')[0];

        if (sched.nextDueDate <= horizon) {
          // Check if open WO already exists for this schedule and due date
          const existingOpen = existingWorkOrders.find(
            (wo) => wo.scheduleId === sched.id && wo.dueDate === sched.nextDueDate && (wo.status === 'scheduled' || wo.status === 'in_progress')
          );

          if (!existingOpen) {
            const plan = planMap.get(sched.planId);
            const machine = machineMap.get(sched.machineId);

            if (plan && machine) {
              const woNumber = `WO-PM-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
              await db.insert(pmWorkOrders).values({
                workOrderNumber: woNumber,
                scheduleId: sched.id,
                planId: plan.id,
                machineId: machine.id,
                branchId: sched.branchId,
                departmentId: sched.departmentId,
                title: `${machine.machineCode} - ${plan.title}`,
                dueDate: sched.nextDueDate,
                priority: plan.priority || 'medium',
                status: 'scheduled',
                assignedEmployeeId: sched.assignedEmployeeId || null,
                checklistResults: (plan.checklistTemplate as any[] || []).map((t) => ({
                  taskId: t.id,
                  task: t.task,
                  type: t.type,
                  status: 'pass',
                  notes: '',
                })),
                partsConsumed: [],
              });
              createdCount++;
            }
          }
        }
      }

      await logEntry(req, 'GENERATE_DUE_PM_WORK_ORDERS', 'pm_work_order', '0', `Auto-generated ${createdCount} scheduled PM work orders.`);
      res.json({ success: true, createdCount, message: `Generated ${createdCount} new PM work orders based on due schedules.` });
    } catch (error: any) {
      console.error('Error generating due work orders:', error);
      res.status(500).json({ error: error.message || 'Failed to auto-generate due work orders' });
    }
  });

  // Start work order
  app.post('/api/pm/work-orders/:id/start', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const woId = parseInt(req.params.id);
      const [wo] = await db.select().from(pmWorkOrders).where(eq(pmWorkOrders.id, woId));
      if (!wo) return res.status(404).json({ error: 'Work order not found' });

      const [updated] = await db.update(pmWorkOrders).set({
        status: 'in_progress',
        startedAt: wo.startedAt || new Date(),
        assignedUserId: req.user?.id || wo.assignedUserId,
        updatedAt: new Date(),
      }).where(eq(pmWorkOrders.id, woId)).returning();

      await logEntry(req, 'START_PM_WORK_ORDER', 'pm_work_order', woId, `Started execution on PM work order ${wo.workOrderNumber}`, wo.branchId);
      res.json(updated);
    } catch (error: any) {
      console.error('Error starting work order:', error);
      res.status(500).json({ error: error.message || 'Failed to start work order' });
    }
  });

  // Complete work order & log checklist results & deduct spare parts & advance recurring schedule
  app.post('/api/pm/work-orders/:id/complete', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const woId = parseInt(req.params.id);
      const {
        checklistResults,
        partsConsumed,
        overallCondition,
        summaryNotes,
        timeSpentMinutes,
        completedByPin,
        completedByName,
        deductFromStock,
      } = req.body;

      const [wo] = await db.select().from(pmWorkOrders).where(eq(pmWorkOrders.id, woId));
      if (!wo) return res.status(404).json({ error: 'Work order not found' });

      let verifiedEmployee: any = null;
      let signoffName = completedByName || req.user?.name || 'Technician';

      // Verify PIN if provided
      if (completedByPin) {
        const [emp] = await db.select().from(employees).where(eq(employees.userCode, completedByPin.trim()));
        if (emp) {
          verifiedEmployee = emp;
          signoffName = `${emp.name} (${emp.employeeCode})`;
        }
      }

      // Check if any checklist item failed
      const hasFailure = Array.isArray(checklistResults) && checklistResults.some((r: any) => r.status === 'fail' || r.isOutOfRange);
      const completionStatus = hasFailure ? 'completed' : 'completed';

      // Process spare parts and fluids deduction from inventory if requested
      const processedParts: any[] = [];
      if (Array.isArray(partsConsumed) && partsConsumed.length > 0) {
        for (const part of partsConsumed) {
          if (part.quantity && Number(part.quantity) > 0) {
            let itemDeducted = false;
            if (deductFromStock !== false && part.itemId) {
              const [invItem] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, parseInt(part.itemId)));
              if (invItem) {
                const newAvailable = Math.max(0, (invItem.availableQuantity || 0) - Number(part.quantity));
                await db.update(inventoryItems).set({
                  availableQuantity: newAvailable,
                  status: newAvailable <= (invItem.minThreshold || 5) ? 'low_stock' : invItem.status,
                }).where(eq(inventoryItems.id, invItem.id));

                // Log movement
                await db.insert(inventoryMovements).values({
                  itemId: invItem.id,
                  quantity: Number(part.quantity),
                  uom: invItem.uom,
                  movementType: 'assigned_to_machine',
                  status: 'completed',
                  fromBranchId: wo.branchId,
                  toBranchId: wo.branchId,
                  fromDepartmentId: wo.departmentId,
                  toDepartmentId: wo.departmentId,
                  toMachineId: wo.machineId,
                  movedByUserId: req.user?.id || 1,
                  notes: `Consumed during PM Work Order ${wo.workOrderNumber} on Machine #${wo.machineId}`,
                });
                itemDeducted = true;
              }
            }
            processedParts.push({
              ...part,
              deductedFromStock: itemDeducted,
            });
          }
        }
      }

      const completedTime = new Date();

      const [updatedWo] = await db.update(pmWorkOrders).set({
        status: completionStatus,
        completedAt: completedTime,
        completedByEmployeeId: verifiedEmployee ? verifiedEmployee.id : wo.assignedEmployeeId,
        completedByUserId: req.user?.id || null,
        completedByPin: completedByPin ? '****' : null,
        completedByName: signoffName,
        checklistResults: checklistResults || wo.checklistResults,
        partsConsumed: processedParts.length > 0 ? processedParts : wo.partsConsumed,
        overallCondition: overallCondition || 'good',
        summaryNotes: summaryNotes || null,
        timeSpentMinutes: timeSpentMinutes ? parseInt(timeSpentMinutes) : (wo.timeSpentMinutes || 30),
        updatedAt: completedTime,
      }).where(eq(pmWorkOrders.id, woId)).returning();

      // If this work order originated from a recurring schedule, advance nextDueDate!
      if (wo.scheduleId) {
        const [schedule] = await db.select().from(pmSchedules).where(eq(pmSchedules.id, wo.scheduleId));
        if (schedule) {
          const todayStr = completedTime.toISOString().split('T')[0];
          const baseDate = schedule.scheduleType === 'rolling_after_completion' ? todayStr : (schedule.nextDueDate || todayStr);
          const nextDue = computeNextDueDate(baseDate, schedule.frequencyType, schedule.frequencyInterval);

          await db.update(pmSchedules).set({
            lastCompletedDate: todayStr,
            nextDueDate: nextDue,
            updatedAt: completedTime,
          }).where(eq(pmSchedules.id, schedule.id));
        }
      }

      await logEntry(
        req,
        'COMPLETE_PM_WORK_ORDER',
        'pm_work_order',
        woId,
        `Completed PM checklist for ${wo.title} (${wo.workOrderNumber}). Condition: ${overallCondition || 'good'}. Signed by ${signoffName}. Parts: ${processedParts.length} consumed.`,
        wo.branchId
      );

      res.json(updatedWo);
    } catch (error: any) {
      console.error('Error completing PM work order:', error);
      res.status(500).json({ error: error.message || 'Failed to complete PM work order' });
    }
  });

  // Skip work order with mandatory reason
  app.post('/api/pm/work-orders/:id/skip', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const woId = parseInt(req.params.id);
      const { skippedReason } = req.body;

      if (!skippedReason || !skippedReason.trim()) {
        return res.status(400).json({ error: 'A justification / reason is mandatory to skip scheduled maintenance' });
      }

      const [wo] = await db.select().from(pmWorkOrders).where(eq(pmWorkOrders.id, woId));
      if (!wo) return res.status(404).json({ error: 'Work order not found' });

      const [updated] = await db.update(pmWorkOrders).set({
        status: 'skipped',
        skippedReason: skippedReason.trim(),
        completedAt: new Date(),
        completedByName: req.user?.name || 'Operator',
        completedByUserId: req.user?.id || null,
        updatedAt: new Date(),
      }).where(eq(pmWorkOrders.id, woId)).returning();

      // If linked to a schedule, advance schedule nextDueDate
      if (wo.scheduleId) {
        const [schedule] = await db.select().from(pmSchedules).where(eq(pmSchedules.id, wo.scheduleId));
        if (schedule) {
          const nextDue = computeNextDueDate(schedule.nextDueDate, schedule.frequencyType, schedule.frequencyInterval);
          await db.update(pmSchedules).set({
            nextDueDate: nextDue,
            updatedAt: new Date(),
          }).where(eq(pmSchedules.id, schedule.id));
        }
      }

      await logEntry(req, 'SKIP_PM_WORK_ORDER', 'pm_work_order', woId, `Skipped scheduled PM work order ${wo.workOrderNumber}. Reason: ${skippedReason}`, wo.branchId);
      res.json(updated);
    } catch (error: any) {
      console.error('Error skipping work order:', error);
      res.status(500).json({ error: error.message || 'Failed to skip PM work order' });
    }
  });

  // 4. PM Compliance & Reliability Reports
  app.get('/api/pm/compliance-report', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, departmentId } = req.query;

      const [allWorkOrders, allSchedules, allPlans, allMachines, allBranches, allDepts] = await Promise.all([
        db.select().from(pmWorkOrders).orderBy(desc(pmWorkOrders.completedAt)),
        db.select().from(pmSchedules),
        db.select().from(pmPlans),
        db.select().from(machines),
        db.select().from(branches),
        db.select().from(departments),
      ]);

      let filteredWOs = allWorkOrders;
      let filteredScheds = allSchedules;

      if (req.user?.role === 'manager' || req.user?.role === 'department') {
        const uBranch = req.user.branchId || 1;
        filteredWOs = filteredWOs.filter((wo) => wo.branchId === uBranch);
        filteredScheds = filteredScheds.filter((s) => s.branchId === uBranch);
        if (req.user.departmentId) {
          filteredWOs = filteredWOs.filter((wo) => wo.departmentId === req.user?.departmentId);
          filteredScheds = filteredScheds.filter((s) => s.departmentId === req.user?.departmentId);
        }
      } else if (branchId) {
        filteredWOs = filteredWOs.filter((wo) => wo.branchId === parseInt(branchId as string));
        filteredScheds = filteredScheds.filter((s) => s.branchId === parseInt(branchId as string));
      }

      if (departmentId) {
        filteredWOs = filteredWOs.filter((wo) => wo.departmentId === parseInt(departmentId as string));
        filteredScheds = filteredScheds.filter((s) => s.departmentId === parseInt(departmentId as string));
      }

      const today = new Date().toISOString().split('T')[0];

      const totalWorkOrders = filteredWOs.length;
      const completedCount = filteredWOs.filter((wo) => wo.status === 'completed').length;
      const scheduledCount = filteredWOs.filter((wo) => wo.status === 'scheduled').length;
      const inProgressCount = filteredWOs.filter((wo) => wo.status === 'in_progress').length;
      const skippedCount = filteredWOs.filter((wo) => wo.status === 'skipped').length;
      const overdueCount = filteredWOs.filter(
        (wo) => wo.dueDate < today && (wo.status === 'scheduled' || wo.status === 'in_progress')
      ).length;

      // Calculate on-time completion (completed where completedAt date <= dueDate)
      const onTimeCompleted = filteredWOs.filter((wo) => {
        if (wo.status !== 'completed' || !wo.completedAt) return false;
        const compDateStr = new Date(wo.completedAt).toISOString().split('T')[0];
        return compDateStr <= wo.dueDate;
      }).length;

      const nonFutureOrders = filteredWOs.filter((wo) => wo.dueDate <= today || wo.status === 'completed' || wo.status === 'skipped');
      const complianceRatePercentage = nonFutureOrders.length > 0
        ? Math.round((completedCount / nonFutureOrders.length) * 100)
        : (totalWorkOrders > 0 ? 100 : 0);

      const onTimeCompletionRatePercentage = completedCount > 0
        ? Math.round((onTimeCompleted / completedCount) * 100)
        : 100;

      // Average duration
      const completedDurations = filteredWOs
        .filter((wo) => wo.status === 'completed' && wo.timeSpentMinutes)
        .map((wo) => wo.timeSpentMinutes || 0);
      const avgDuration = completedDurations.length > 0
        ? Math.round(completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length)
        : 60;

      // Overall Condition Breakdown
      const conditionBreakdown = {
        excellent: filteredWOs.filter((wo) => wo.overallCondition === 'excellent').length,
        good: filteredWOs.filter((wo) => wo.overallCondition === 'good').length,
        fair: filteredWOs.filter((wo) => wo.overallCondition === 'fair').length,
        poor: filteredWOs.filter((wo) => wo.overallCondition === 'poor').length,
        critical: filteredWOs.filter((wo) => wo.overallCondition === 'critical').length,
      };

      // Category breakdown
      const planMap = new Map(allPlans.map((p) => [p.id, p]));
      const machineMap = new Map(allMachines.map((m) => [m.id, m]));
      const branchMap = new Map(allBranches.map((b) => [b.id, b]));
      const deptMap = new Map(allDepts.map((d) => [d.id, d]));

      const catTotals: Record<string, { total: number; completed: number }> = {};
      for (const wo of filteredWOs) {
        const plan = planMap.get(wo.planId);
        const cat = plan?.category || 'General';
        if (!catTotals[cat]) catTotals[cat] = { total: 0, completed: 0 };
        catTotals[cat].total++;
        if (wo.status === 'completed') catTotals[cat].completed++;
      }

      const categoryBreakdown = Object.entries(catTotals).map(([category, stats]) => ({
        category,
        total: stats.total,
        completed: stats.completed,
      }));

      const recentWOs = filteredWOs.slice(0, 15).map((wo) => ({
        ...wo,
        plan: planMap.get(wo.planId),
        machine: machineMap.get(wo.machineId),
        branch: branchMap.get(wo.branchId),
        department: deptMap.get(wo.departmentId),
      }));

      res.json({
        totalSchedules: filteredScheds.length,
        activeSchedules: filteredScheds.filter((s) => s.status === 'active').length,
        totalWorkOrders,
        completedCount,
        scheduledCount,
        inProgressCount,
        overdueCount,
        skippedCount,
        complianceRatePercentage,
        onTimeCompletionRatePercentage,
        avgCompletionDurationMinutes: avgDuration,
        conditionBreakdown,
        categoryBreakdown,
        recentWorkOrders: recentWOs,
      });
    } catch (error: any) {
      console.error('Error computing PM compliance report:', error);
      res.status(500).json({ error: 'Failed to generate PM compliance report' });
    }
  });

  // 5. Notification & Summary Badges for Header / Sidebar / Kiosk
  app.get('/api/pm/summary-badges', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { branchId, departmentId } = req.query;
      let allWOs = await db.select().from(pmWorkOrders);

      if (req.user?.role === 'manager' || req.user?.role === 'department') {
        const uBranch = req.user.branchId || 1;
        allWOs = allWOs.filter((wo) => wo.branchId === uBranch);
        if (req.user.departmentId) {
          allWOs = allWOs.filter((wo) => wo.departmentId === req.user?.departmentId);
        }
      } else if (branchId) {
        allWOs = allWOs.filter((wo) => wo.branchId === parseInt(branchId as string));
      }

      if (departmentId) {
        allWOs = allWOs.filter((wo) => wo.departmentId === parseInt(departmentId as string));
      }

      const today = new Date().toISOString().split('T')[0];
      const in7Days = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];

      const activePending = allWOs.filter((wo) => wo.status === 'scheduled' || wo.status === 'in_progress');

      const overdue = activePending.filter((wo) => wo.dueDate < today).length;
      const dueToday = activePending.filter((wo) => wo.dueDate === today).length;
      const dueThisWeek = activePending.filter((wo) => wo.dueDate >= today && wo.dueDate <= in7Days).length;
      const inProgress = allWOs.filter((wo) => wo.status === 'in_progress').length;

      res.json({
        overdue,
        dueToday,
        dueThisWeek,
        inProgress,
        totalPending: overdue + dueToday + inProgress,
      });
    } catch (error: any) {
      console.error('Error fetching PM summary badges:', error);
      res.status(500).json({ error: 'Failed to fetch summary badges' });
    }
  });

  // 6. Employee Kiosk PM Checklists (PIN Verified shop floor access)
  app.post('/api/department/pm-tasks', async (req, res) => {
    try {
      const { pin, branchId, departmentId } = req.body;
      if (!pin) {
        return res.status(400).json({ error: '4-digit employee PIN is required' });
      }

      const [employee] = await db.select().from(employees).where(eq(employees.userCode, pin.trim()));
      if (!employee || !employee.isActive) {
        return res.status(401).json({ error: 'Invalid or inactive employee PIN' });
      }

      const bId = branchId ? parseInt(branchId) : employee.branchId;
      let allWOs = await db.select().from(pmWorkOrders).where(
        and(
          eq(pmWorkOrders.branchId, bId),
          inArray(pmWorkOrders.status, ['scheduled', 'in_progress'])
        )
      ).orderBy(pmWorkOrders.dueDate);

      if (departmentId) {
        allWOs = allWOs.filter((wo) => wo.departmentId === parseInt(departmentId));
      }

      const [allPlans, allMachines, allBranches, allDepts] = await Promise.all([
        db.select().from(pmPlans),
        db.select().from(machines),
        db.select().from(branches),
        db.select().from(departments),
      ]);

      const planMap = new Map(allPlans.map((p) => [p.id, p]));
      const machineMap = new Map(allMachines.map((m) => [m.id, m]));
      const branchMap = new Map(allBranches.map((b) => [b.id, b]));
      const deptMap = new Map(allDepts.map((d) => [d.id, d]));

      const today = new Date().toISOString().split('T')[0];

      const enriched = allWOs.map((wo) => {
        const isOverdue = wo.dueDate < today;
        return {
          ...wo,
          plan: planMap.get(wo.planId),
          machine: machineMap.get(wo.machineId),
          branch: branchMap.get(wo.branchId),
          department: deptMap.get(wo.departmentId),
          isOverdue,
        };
      });

      res.json({
        employee: {
          id: employee.id,
          name: employee.name,
          employeeCode: employee.employeeCode,
          branchId: employee.branchId,
        },
        workOrders: enriched,
      });
    } catch (error: any) {
      console.error('Error fetching kiosk PM tasks:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch kiosk PM tasks' });
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

      const allModels = await db.select().from(models);
      const modelMap = new Map(allModels.map(m => [m.id, m]));

      const lowStockItems = allItems.filter(i => {
        if (i.modelId) {
          const m = modelMap.get(i.modelId);
          if (m) {
            const thresh = m.minThreshold !== undefined && m.minThreshold !== null ? m.minThreshold : 5;
            const modelItems = allItems.filter(it => it.modelId === m.id);
            const totalAvail = modelItems.reduce((acc, it) => acc + (it.availableQuantity || 0), 0);
            return totalAvail <= thresh;
          }
        }
        return i.availableQuantity <= (i.minThreshold ?? 5);
      });
      const engagedAssets = assets.filter(i => i.engagementStatus === 'engaged' || i.status === 'in_use');
      const activeRepairs = allRepairs.filter(r => r.status === 'sent_to_vendor');
      const pendingRequests = allRequests.filter(r => r.status === 'pending');
      const pendingTransfers = allMovements.filter(m =>
        m.movementType === 'branch_to_branch' &&
        m.status === 'pending_acceptance' &&
        (targetBranch ? m.toBranchId === targetBranch : true)
      );

      // PM Work Orders metrics
      const allPMWorkOrders = await db.select().from(pmWorkOrders);
      const todayStr = new Date().toISOString().split('T')[0];
      const activePMOrders = allPMWorkOrders.filter(wo => 
        (wo.status === 'scheduled' || wo.status === 'in_progress') &&
        (targetBranch ? wo.branchId === targetBranch : true)
      );
      const overduePMOrders = activePMOrders.filter(wo => wo.dueDate < todayStr);
      
      const pastOrDoneOrders = allPMWorkOrders.filter(wo => 
        (wo.dueDate <= todayStr || wo.status === 'completed' || wo.status === 'skipped') &&
        (targetBranch ? wo.branchId === targetBranch : true)
      );
      const completedPMOrders = pastOrDoneOrders.filter(wo => wo.status === 'completed');
      const pmCompliance = pastOrDoneOrders.length > 0 
        ? Math.round((completedPMOrders.length / pastOrDoneOrders.length) * 100) 
        : 100;

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
        pmDueCount: activePMOrders.length,
        pmOverdueCount: overduePMOrders.length,
        pmComplianceRate: pmCompliance,
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
        locationsCount,
        machinesCount,
        employeesCount,
        employeeDepartmentsCount,
        categoriesCount,
        userCategoryPermissionsCount,
        customFieldsCount,
        fieldSetsCount,
        fieldSetItemsCount,
        modelsCount,
        vendorsCount,
        vendorBranchAssignmentsCount,
        requestReasonsCount,
        inventoryItemsCount,
        stockLocationsCount,
        employeeRequestsCount,
        inventoryMovementsCount,
        vendorRepairsCount,
        entryLogsCount,
        usersCount,
        pmPlansCount,
        pmSchedulesCount,
        pmWorkOrdersCount,
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(branches).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(departments).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(locations).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(machines).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(employees).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(employeeDepartments).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(categories).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(userCategoryPermissions).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(customFields).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(fieldSets).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(fieldSetItems).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(models).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(vendors).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(vendorBranchAssignments).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(requestReasons).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(inventoryItems).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(stockLocations).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(employeeRequests).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(inventoryMovements).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(vendorRepairs).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(entryLogs).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(users).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(pmPlans).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(pmSchedules).then(r => Number(r[0]?.count || 0)).catch(() => 0),
        db.select({ count: sql<number>`count(*)` }).from(pmWorkOrders).then(r => Number(r[0]?.count || 0)).catch(() => 0),
      ]);

      const tableStats = [
        // 1. Inventory & Stock Quantities
        {
          tableName: 'inventory_items',
          rowCount: inventoryItemsCount,
          description: 'Assets & Consumables Catalog Items',
          group: 'inventory' as const,
          impactNote: 'Wipes all master asset and consumable stock records, serials, and quantities.',
        },
        {
          tableName: 'stock_locations',
          rowCount: stockLocationsCount,
          description: 'Stock Location Allocations',
          group: 'inventory' as const,
          impactNote: 'Clears stock allocation balances across branch/department locations and machines.',
        },
        // 2. Operational Logs & Workflows
        {
          tableName: 'pm_work_orders',
          rowCount: pmWorkOrdersCount,
          description: 'PM Work Orders & Completed Checklists',
          group: 'operations' as const,
          impactNote: 'Wipes active and completed machine maintenance work orders, technician measurements, and condition logs.',
        },
        {
          tableName: 'pm_schedules',
          rowCount: pmSchedulesCount,
          description: 'PM Machine Recurring Schedules',
          group: 'operations' as const,
          impactNote: 'Clears machine maintenance frequency assignments, next due dates, and auto-generation links.',
        },
        {
          tableName: 'pm_plans',
          rowCount: pmPlansCount,
          description: 'PM Master Plans & Checklist Templates',
          group: 'catalog' as const,
          impactNote: 'Deletes master maintenance task templates, required spare parts lists, and safety guidelines.',
        },
        {
          tableName: 'inventory_movements',
          rowCount: inventoryMovementsCount,
          description: 'Stock Transfers & Tracking History',
          group: 'operations' as const,
          impactNote: 'Clears transfer logs, branch-to-branch moves, and machine assignment logs.',
        },
        {
          tableName: 'employee_requests',
          rowCount: employeeRequestsCount,
          description: 'Department Issuances & Requisitions',
          group: 'operations' as const,
          impactNote: 'Wipes punch portal requisitions, PIN verifications, and issuance audit records.',
        },
        {
          tableName: 'vendor_repairs',
          rowCount: vendorRepairsCount,
          description: 'Vendor Repairs & Engagements',
          group: 'operations' as const,
          impactNote: 'Clears maintenance work orders, repair logs, and asset downtime history.',
        },
        // 3. Catalogs & Specifications
        {
          tableName: 'models',
          rowCount: modelsCount,
          description: 'Predefined Asset Models',
          group: 'catalog' as const,
          impactNote: 'Deletes model templates, photos, and manufacturer specifications.',
        },
        {
          tableName: 'field_sets',
          rowCount: fieldSetsCount,
          description: 'Field Set Groupings',
          group: 'catalog' as const,
          impactNote: 'Clears dynamic custom field groupings.',
        },
        {
          tableName: 'field_set_items',
          rowCount: fieldSetItemsCount,
          description: 'Field Set Associations',
          group: 'catalog' as const,
          impactNote: 'Clears field set mapping links.',
        },
        {
          tableName: 'custom_fields',
          rowCount: customFieldsCount,
          description: 'Dynamic Custom Fields',
          group: 'catalog' as const,
          impactNote: 'Removes category-specific custom attributes and specifications.',
        },
        {
          tableName: 'categories',
          rowCount: categoriesCount,
          description: 'Item & Asset Categories',
          group: 'catalog' as const,
          impactNote: 'Removes all category definitions (cascades to models & items if not empty).',
        },
        {
          tableName: 'request_reasons',
          rowCount: requestReasonsCount,
          description: 'Pre-fed Requisition Reasons',
          group: 'catalog' as const,
          impactNote: 'Wipes standard preset reasons for department employee punch requests.',
        },
        // 4. Vendors & External Partners
        {
          tableName: 'vendors',
          rowCount: vendorsCount,
          description: 'Vendors & Suppliers',
          group: 'vendors' as const,
          impactNote: 'Clears vendor directory and contact profiles.',
        },
        {
          tableName: 'vendor_branch_assignments',
          rowCount: vendorBranchAssignmentsCount,
          description: 'Vendor Branch Visibility Rules',
          group: 'vendors' as const,
          impactNote: 'Clears cross-branch vendor access mappings.',
        },
        // 5. Organizational Structure
        {
          tableName: 'machines',
          rowCount: machinesCount,
          description: 'Machinery & Equipment',
          group: 'organization' as const,
          impactNote: 'Wipes production machines, tooling equipment, and machine codes.',
        },
        {
          tableName: 'locations',
          rowCount: locationsCount,
          description: 'Storage Locations & Racks',
          group: 'organization' as const,
          impactNote: 'Wipes bays, racks, cleanrooms, and warehouse storage locations.',
        },
        {
          tableName: 'employees',
          rowCount: employeesCount,
          description: 'Authorized Personnel',
          group: 'organization' as const,
          impactNote: 'Wipes registered employees, employee codes, and 4-digit PINs.',
        },
        {
          tableName: 'employee_departments',
          rowCount: employeeDepartmentsCount,
          description: 'Employee Department Links',
          group: 'organization' as const,
          impactNote: 'Clears employee-to-department assignments.',
        },
        {
          tableName: 'departments',
          rowCount: departmentsCount,
          description: 'Departments & Production Areas',
          group: 'organization' as const,
          impactNote: 'Deletes department divisions and shop floor areas.',
        },
        {
          tableName: 'branches',
          rowCount: branchesCount,
          description: 'Branch Facilities',
          group: 'organization' as const,
          impactNote: 'Deletes branch locations and warehouse facilities.',
        },
        // 6. Security & Audit
        {
          tableName: 'user_category_permissions',
          rowCount: userCategoryPermissionsCount,
          description: 'User Category Access Permissions',
          group: 'security' as const,
          impactNote: 'Clears role-based category restriction assignments.',
        },
        {
          tableName: 'entry_logs',
          rowCount: entryLogsCount,
          description: 'Immutable Audit Trail Logs',
          group: 'security' as const,
          impactNote: 'Clears system activity and user audit trail history.',
        },
        {
          tableName: 'users',
          rowCount: usersCount,
          description: 'System Users & Role Access',
          group: 'security' as const,
          impactNote: 'Resets user logins (Administrator account is automatically preserved).',
        },
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

  // Explicitly trigger schema & table initialization / migration
  app.post('/api/postgres-config/init-tables', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access Denied: Administrator role required.' });
      }

      const initResult = await initializeDatabaseSchema();
      await logEntry(req, 'INIT_DATABASE_TABLES', 'SYSTEM_DATABASE', '0', `Database tables initialized/verified (${initResult.existingTablesCount} tables active)`);

      if (!initResult.success) {
        return res.status(500).json({ success: false, error: initResult.message });
      }

      res.json({
        success: true,
        message: initResult.message,
        activeTablesCount: initResult.existingTablesCount,
      });
    } catch (error: any) {
      console.error('Error initializing tables:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to initialize database tables' });
    }
  });

  // Inspect database schema status
  app.get('/api/postgres-config/schema-status', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const tableCheckRes = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE';
      `);
      const existingTables = tableCheckRes.rows.map((r: any) => r.table_name);
      const missingTables = SCHEMA_TABLES.filter((t) => !existingTables.includes(t));

      res.json({
        totalExpected: SCHEMA_TABLES.length,
        totalExisting: existingTables.length,
        isComplete: missingTables.length === 0,
        existingTables,
        missingTables,
      });
    } catch (error: any) {
      console.error('Error checking schema status:', error);
      res.status(500).json({ error: error.message || 'Failed to check schema status' });
    }
  });

  // Admin Data Table Reset / Purge Endpoint
  app.post('/api/postgres-config/reset-tables', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          error: 'Access Denied: Only Administrator role has authorization to reset database tables.',
        });
      }

      const { tables, reseedDemo } = req.body;

      if (!Array.isArray(tables) || tables.length === 0) {
        return res.status(400).json({ error: 'Please select at least one table to reset.' });
      }

      // Whitelist validation: Ensure all requested tables exist in SCHEMA_TABLES
      const invalidTables = tables.filter((t: string) => !SCHEMA_TABLES.includes(t));
      if (invalidTables.length > 0) {
        return res.status(400).json({
          error: `Invalid table name(s) requested: ${invalidTables.join(', ')}`,
        });
      }

      const validTables: string[] = tables.filter((t: string) => SCHEMA_TABLES.includes(t));

      if (reseedDemo) {
        // If user requested complete wipe and demo dataset reseed
        await seedDatabase(true);
        await logEntry(
          req,
          'RESET_AND_RESEED_DATABASE',
          'SYSTEM_DATABASE',
          'ALL',
          `Full database reset and comprehensive demo dataset re-seeded by Administrator ${req.user.name}`
        );

        return res.json({
          success: true,
          message: 'All tables reset and fresh demo dataset seeded successfully!',
          resetTables: SCHEMA_TABLES,
          reseeded: true,
        });
      }

      // Clear selected tables in reverse dependency order
      for (const t of validTables) {
        try {
          await pool.query(`TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE;`);
        } catch (_) {
          try {
            await pool.query(`DELETE FROM "${t}";`);
            const seqRes = await pool.query(`SELECT pg_get_serial_sequence($1, 'id');`, [t]);
            const seqName = seqRes.rows[0]?.pg_get_serial_sequence;
            if (seqName) {
              await pool.query(`SELECT setval($1, 1, false);`, [seqName]);
            }
          } catch (delErr) {
            console.warn(`Could not clear table ${t}:`, delErr);
          }
        }
      }

      // Safety preservation: If 'users' table was truncated, immediately re-create active Admin account
      if (validTables.includes('users')) {
        const envAdminEmail = (process.env.ADMIN_EMAIL || process.env.ADMIN_USER || 'admin@company.local').trim().toLowerCase();
        const envAdminPass = (process.env.ADMIN_PASSWORD || 'admin123').trim();
        const currentAdminName = req.user?.name || process.env.ADMIN_NAME || 'System Administrator';
        const currentAdminEmail = req.user?.email || envAdminEmail;
        const currentAdminUid = req.user?.uid || `admin_${Date.now()}`;
        const adminHash = hashPassword(envAdminPass);

        await db.insert(users).values({
          uid: currentAdminUid,
          name: currentAdminName,
          email: currentAdminEmail,
          password: adminHash,
          role: 'admin',
          isActive: true,
        });

        console.log(`[PostgreSQL] Safely preserved and re-created active Admin user (${currentAdminEmail}) after users table reset.`);
      }

      // Safety preservation: If 'branches' was reset, ensure at least a default branch exists if needed
      if (validTables.includes('branches') && !validTables.includes('departments')) {
        const [defaultBranch] = await db.insert(branches).values({
          name: 'Main Facility & Headquarters',
          code: 'BR-MAIN',
          location: 'Headquarters Facility',
          phone: '+1 555-0100',
        }).returning();

        if (defaultBranch && req.user?.id) {
          try {
            await db.update(users).set({ branchId: defaultBranch.id }).where(eq(users.id, req.user.id));
          } catch (_) {}
        }
      }

      // Log the reset action in audit logs (even if entry_logs was truncated, write this new entry)
      await logEntry(
        req,
        'RESET_DATABASE_TABLES',
        'SYSTEM_DATABASE',
        validTables.length,
        `Admin ${req.user.name} (${req.user.email}) permanently reset ${validTables.length} table(s): ${validTables.join(', ')}`
      );

      res.json({
        success: true,
        message: `Successfully reset data in ${validTables.length} selected table(s).`,
        resetTables: validTables,
        clearedCount: validTables.length,
      });
    } catch (error: any) {
      console.error('Error resetting database tables:', error);
      res.status(500).json({ error: error.message || 'Failed to reset selected database tables' });
    }
  });

  // ====================================================
  // DATABASE BACKUP & RESTORE UTILITY (ADMINISTRATOR ONLY)
  // ====================================================

  const BACKUPS_DIR = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(BACKUPS_DIR)) {
    try {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    } catch (e) {
      console.warn('Could not create backups directory:', e);
    }
  }

  const TABLE_OBJECTS: Record<string, any> = {
    branches,
    departments,
    locations,
    machines,
    employees,
    employee_departments: employeeDepartments,
    categories,
    user_category_permissions: userCategoryPermissions,
    custom_fields: customFields,
    field_sets: fieldSets,
    field_set_items: fieldSetItems,
    models,
    vendors,
    vendor_branch_assignments: vendorBranchAssignments,
    request_reasons: requestReasons,
    inventory_items: inventoryItems,
    stock_locations: stockLocations,
    employee_requests: employeeRequests,
    inventory_movements: inventoryMovements,
    vendor_repairs: vendorRepairs,
    entry_logs: entryLogs,
    pm_plans: pmPlans,
    pm_schedules: pmSchedules,
    pm_work_orders: pmWorkOrders,
    users,
  };

  const RESTORE_ORDER = [
    'branches',
    'departments',
    'locations',
    'machines',
    'employees',
    'employee_departments',
    'categories',
    'user_category_permissions',
    'custom_fields',
    'field_sets',
    'field_set_items',
    'models',
    'vendors',
    'vendor_branch_assignments',
    'request_reasons',
    'inventory_items',
    'stock_locations',
    'employee_requests',
    'inventory_movements',
    'vendor_repairs',
    'entry_logs',
    'pm_plans',
    'pm_schedules',
    'pm_work_orders',
    'users',
  ];

  function formatSqlLiteral(val: any): string {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
    if (val instanceof Date) return `'${val.toISOString()}'::timestamptz`;
    if (typeof val === 'object') {
      const jsonStr = JSON.stringify(val);
      return `'${jsonStr.replace(/'/g, "''")}'::jsonb`;
    }
    const str = String(val);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str)) {
      return `'${str.replace(/'/g, "''")}'::timestamptz`;
    }
    return `'${str.replace(/'/g, "''")}'`;
  }

  function generatePostgresSqlDump(
    tablesData: Record<string, any[]>,
    metadata: any
  ): string {
    const lines: string[] = [];

    lines.push(`-- ==========================================================`);
    lines.push(`-- AssetFlow PostgreSQL Database Dump`);
    lines.push(`-- Database: ${metadata.databaseName}`);
    lines.push(`-- Generated: ${metadata.createdAt}`);
    lines.push(`-- Exporter: ${metadata.exportedBy?.name || 'Administrator'} (${metadata.exportedBy?.email || ''})`);
    lines.push(`-- Total Tables: ${metadata.totalTables}`);
    lines.push(`-- Total Records: ${metadata.totalRecords}`);
    lines.push(`-- Format: Standard PostgreSQL SQL Dump (psql / DDL compatible)`);
    lines.push(`-- ==========================================================`);
    lines.push(`-- METADATA: ${JSON.stringify(metadata)}`);
    lines.push(`-- ==========================================================\n`);

    lines.push(`SET statement_timeout = 0;`);
    lines.push(`SET client_encoding = 'UTF8';`);
    lines.push(`SET standard_conforming_strings = on;`);
    lines.push(`SET check_function_bodies = false;`);
    lines.push(`SET client_min_messages = warning;\n`);

    lines.push(`BEGIN;\n`);

    lines.push(`-- Step 1: Clear existing tables in reverse dependency order`);
    const reverseOrder = [...RESTORE_ORDER].reverse();
    for (const table of reverseOrder) {
      lines.push(`DELETE FROM "${table}";`);
    }
    lines.push('');

    lines.push(`-- Step 2: Insert table data in relational dependency order`);
    for (const table of RESTORE_ORDER) {
      const rows = tablesData[table];
      const count = Array.isArray(rows) ? rows.length : 0;
      lines.push(`-- Table: "${table}" (${count} records)`);

      if (Array.isArray(rows) && rows.length > 0) {
        const columns = Object.keys(rows[0]);
        const quotedCols = columns.map((col) => `"${col}"`).join(', ');

        const batchSize = 50;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const valueTuples = batch.map((row) => {
            const vals = columns.map((col) => formatSqlLiteral(row[col]));
            return `  (${vals.join(', ')})`;
          });

          lines.push(`INSERT INTO "${table}" (${quotedCols}) VALUES\n${valueTuples.join(',\n')};`);
        }

        // Sequence synchronization (safely checks if serial sequence exists for 'id')
        lines.push(`SELECT CASE WHEN pg_get_serial_sequence('${table}', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false) ELSE NULL END;\n`);
      } else {
        lines.push(`-- (0 records)\n`);
      }
    }

    lines.push(`COMMIT;\n`);
    lines.push(`-- End of PostgreSQL Database Dump\n`);

    return lines.join('\n');
  }

  // 1. Export & Download Full Database Backup (.sql or .json)
  app.get('/api/database/backup', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access Denied: Only Administrator role can export database backups.' });
      }

      const requestedFormat = (req.query.format === 'json' ? 'json' : 'sql');
      const description = typeof req.query.description === 'string' ? req.query.description : 'Manual local database backup';
      const now = new Date();
      const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupId = `backup_${Date.now()}`;
      const filename = `assetflow_db_backup_${dateStr}.${requestedFormat}`;

      // Query raw database records directly via pg pool so that column names exactly match the PostgreSQL schema
      const tablesData: Record<string, any[]> = {};
      const tableCounts: Record<string, number> = {};
      let totalRecords = 0;

      for (const tableName of SCHEMA_TABLES) {
        try {
          const pgRes = await pool.query(`SELECT * FROM "${tableName}";`);
          tablesData[tableName] = pgRes.rows;
          tableCounts[tableName] = pgRes.rows.length;
          totalRecords += pgRes.rows.length;
        } catch (tblErr) {
          tablesData[tableName] = [];
          tableCounts[tableName] = 0;
        }
      }

      const metadata = {
        id: backupId,
        version: '1.0',
        format: requestedFormat,
        createdAt: now.toISOString(),
        exportedBy: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
        },
        databaseName: process.env.SQL_DB_NAME || process.env.PGDATABASE || 'assetflow_db',
        totalTables: SCHEMA_TABLES.length,
        totalRecords,
        tableCounts,
        description,
      };

      if (requestedFormat === 'sql') {
        const sqlDump = generatePostgresSqlDump(tablesData, metadata);

        // Save local server snapshot in ./backups/
        try {
          if (!fs.existsSync(BACKUPS_DIR)) {
            fs.mkdirSync(BACKUPS_DIR, { recursive: true });
          }
          fs.writeFileSync(path.join(BACKUPS_DIR, filename), sqlDump, 'utf-8');
        } catch (fsErr) {
          console.warn('Could not save snapshot file to local backups directory:', fsErr);
        }

        await logEntry(
          req,
          'BACKUP_DATABASE',
          'SYSTEM_DATABASE',
          backupId,
          `Admin ${req.user.name} created full PostgreSQL SQL dump (${totalRecords} records across ${SCHEMA_TABLES.length} tables). File: ${filename}`
        );

        if (req.query.download === 'true') {
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.setHeader('Content-Type', 'application/sql');
          return res.send(sqlDump);
        }

        return res.json({
          success: true,
          filename,
          format: 'sql',
          metadata,
          sqlDump,
        });
      }

      const backupPayload = {
        metadata,
        tables: tablesData,
      };

      // Save a local server snapshot in ./backups/
      try {
        if (!fs.existsSync(BACKUPS_DIR)) {
          fs.mkdirSync(BACKUPS_DIR, { recursive: true });
        }
        fs.writeFileSync(path.join(BACKUPS_DIR, filename), JSON.stringify(backupPayload, null, 2), 'utf-8');
      } catch (fsErr) {
        console.warn('Could not save snapshot file to local backups directory:', fsErr);
      }

      // Log action
      await logEntry(
        req,
        'BACKUP_DATABASE',
        'SYSTEM_DATABASE',
        backupId,
        `Admin ${req.user.name} created full database backup (${totalRecords} records across ${SCHEMA_TABLES.length} tables). File: ${filename}`
      );

      if (req.query.download === 'true') {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/json');
        return res.send(JSON.stringify(backupPayload, null, 2));
      }

      res.json({
        success: true,
        filename,
        format: 'json',
        metadata,
        backup: backupPayload,
      });
    } catch (error: any) {
      console.error('Error creating database backup:', error);
      res.status(500).json({ error: error.message || 'Failed to create database backup' });
    }
  });

  // 2. List Local Server Snapshots (.sql and .json)
  app.get('/api/database/snapshots', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access Denied: Administrator role required.' });
      }

      if (!fs.existsSync(BACKUPS_DIR)) {
        return res.json([]);
      }

      const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith('.json') || f.endsWith('.sql'));
      const snapshots = [];

      for (const file of files) {
        try {
          const filePath = path.join(BACKUPS_DIR, file);
          const stat = fs.statSync(filePath);
          const sizeBytes = stat.size;
          const sizeFormatted = sizeBytes < 1024 * 1024
            ? `${(sizeBytes / 1024).toFixed(1)} KB`
            : `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;

          if (file.endsWith('.sql')) {
            const content = fs.readFileSync(filePath, 'utf-8');
            let meta: any = null;
            const metaMatch = content.match(/-- METADATA: (\{.*\})/);
            if (metaMatch) {
              try {
                meta = JSON.parse(metaMatch[1]);
              } catch (_) {}
            }

            snapshots.push({
              filename: file,
              id: meta?.id || file,
              format: 'sql',
              createdAt: meta?.createdAt || stat.mtime.toISOString(),
              sizeBytes,
              sizeFormatted,
              totalRecords: meta?.totalRecords ?? 0,
              totalTables: meta?.totalTables ?? SCHEMA_TABLES.length,
              creatorName: meta?.exportedBy?.name || 'System Administrator',
              creatorEmail: meta?.exportedBy?.email || 'admin@company.local',
              description: meta?.description || 'PostgreSQL SQL Dump',
            });
          } else {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            snapshots.push({
              filename: file,
              id: parsed.metadata?.id || file,
              format: 'json',
              createdAt: parsed.metadata?.createdAt || stat.mtime.toISOString(),
              sizeBytes,
              sizeFormatted,
              totalRecords: parsed.metadata?.totalRecords ?? 0,
              totalTables: parsed.metadata?.totalTables ?? Object.keys(parsed.tables || {}).length,
              creatorName: parsed.metadata?.exportedBy?.name || 'System Administrator',
              creatorEmail: parsed.metadata?.exportedBy?.email || 'admin@company.local',
              description: parsed.metadata?.description,
            });
          }
        } catch (readErr) {
          console.warn(`Error reading snapshot ${file}:`, readErr);
        }
      }

      snapshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(snapshots);
    } catch (error: any) {
      console.error('Error listing snapshots:', error);
      res.status(500).json({ error: error.message || 'Failed to list snapshots' });
    }
  });

  // 3. Download Local Server Snapshot
  app.get('/api/database/snapshots/:filename/download', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access Denied: Administrator role required.' });
      }

      const filename = path.basename(req.params.filename);
      const filePath = path.join(BACKUPS_DIR, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Snapshot file not found' });
      }

      res.download(filePath, filename);
    } catch (error: any) {
      console.error('Error downloading snapshot:', error);
      res.status(500).json({ error: error.message || 'Failed to download snapshot' });
    }
  });

  // 4. Delete Local Server Snapshot
  app.delete('/api/database/snapshots/:filename', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access Denied: Administrator role required.' });
      }

      const filename = path.basename(req.params.filename);
      const filePath = path.join(BACKUPS_DIR, filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await logEntry(req, 'DELETE_BACKUP_SNAPSHOT', 'SYSTEM_DATABASE', filename, `Deleted backup snapshot ${filename}`);
      res.json({ success: true, message: `Snapshot ${filename} deleted successfully` });
    } catch (error: any) {
      console.error('Error deleting snapshot:', error);
      res.status(500).json({ error: error.message || 'Failed to delete snapshot' });
    }
  });

  // 5. Pre-Restore Validation & Comparison Inspection (.sql or .json)
  app.post('/api/database/restore/validate', authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access Denied: Administrator role required.' });
      }

      let payload = req.body?.backup;
      let rawSqlScript: string | null = req.body?.sqlDump || null;
      let isSqlFormat = false;

      if (req.body?.snapshotFilename) {
        const snapshotPath = path.join(BACKUPS_DIR, path.basename(req.body.snapshotFilename));
        if (fs.existsSync(snapshotPath)) {
          if (req.body.snapshotFilename.endsWith('.sql')) {
            rawSqlScript = fs.readFileSync(snapshotPath, 'utf-8');
            isSqlFormat = true;
          } else {
            payload = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
          }
        }
      } else if (rawSqlScript) {
        isSqlFormat = true;
      }

      const currentTableCounts: Record<string, number> = {};
      const tableDescriptions: Record<string, string> = {
        branches: 'Branch Facilities & Warehouses',
        departments: 'Departments & Production Areas',
        locations: 'Storage Locations & Racks',
        machines: 'Machinery & Equipment',
        employees: 'Authorized Personnel',
        employee_departments: 'Employee Department Links',
        categories: 'Item & Asset Categories',
        user_category_permissions: 'Category Access Permissions',
        custom_fields: 'Dynamic Custom Fields',
        field_sets: 'Field Set Groupings',
        field_set_items: 'Field Set Associations',
        models: 'Predefined Asset Models',
        vendors: 'Vendors & Suppliers',
        vendor_branch_assignments: 'Vendor Branch Visibility Rules',
        request_reasons: 'Pre-fed Requisition Reasons',
        inventory_items: 'Assets & Consumables Catalog',
        stock_locations: 'Stock Location Allocations',
        employee_requests: 'Department Issuances & Requisitions',
        inventory_movements: 'Stock Transfers & Tracking History',
        vendor_repairs: 'Vendor Repairs & Engagements',
        entry_logs: 'Immutable Audit Trail Logs',
        pm_plans: 'PM Master Plans & Checklist Templates',
        pm_schedules: 'PM Recurring Schedules',
        pm_work_orders: 'PM Work Orders & Executions',
        users: 'System Users & Login Accounts',
      };

      for (const tableName of SCHEMA_TABLES) {
        const tableObj = TABLE_OBJECTS[tableName];
        if (tableObj) {
          try {
            const countRes = await db.select({ count: sql<number>`count(*)` }).from(tableObj);
            currentTableCounts[tableName] = Number(countRes[0]?.count || 0);
          } catch (_) {
            currentTableCounts[tableName] = 0;
          }
        }
      }

      // Handle PostgreSQL SQL format validation
      if (isSqlFormat && rawSqlScript) {
        let meta: any = null;
        const metaMatch = rawSqlScript.match(/-- METADATA: (\{.*\})/);
        if (metaMatch) {
          try {
            meta = JSON.parse(metaMatch[1]);
          } catch (_) {}
        }

        const backupTableCounts: Record<string, number> = meta?.tableCounts || {};
        let totalRecordsToRestore = 0;

        if (!meta?.tableCounts) {
          for (const tableName of SCHEMA_TABLES) {
            const regex = new RegExp(`INSERT INTO "${tableName}"`, 'g');
            const matches = rawSqlScript.match(regex);
            backupTableCounts[tableName] = matches ? matches.length : 0;
          }
        }

        const tableDiscrepancies = [];
        for (const tableName of SCHEMA_TABLES) {
          const count = backupTableCounts[tableName] || 0;
          totalRecordsToRestore += count;
          tableDiscrepancies.push({
            tableName,
            description: tableDescriptions[tableName] || tableName,
            currentRows: currentTableCounts[tableName] || 0,
            backupRows: count,
          });
        }

        return res.json({
          valid: true,
          fileFormat: 'sql',
          metadata: meta || {
            id: 'sql_dump',
            databaseName: process.env.SQL_DB_NAME || 'assetflow_db',
            createdAt: new Date().toISOString(),
            totalTables: SCHEMA_TABLES.length,
            totalRecords: totalRecordsToRestore,
            description: 'PostgreSQL SQL Data Dump',
          },
          currentTableCounts,
          backupTableCounts,
          tableDiscrepancies,
          totalRecordsToRestore,
          missingTables: [],
        });
      }

      // Handle JSON format validation
      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ valid: false, error: 'Invalid backup format. Expected a valid JSON object or SQL script.' });
      }

      if (!payload.tables || typeof payload.tables !== 'object') {
        return res.status(400).json({ valid: false, error: 'Invalid backup file: "tables" object is missing.' });
      }

      const backupTableCounts: Record<string, number> = {};
      const tableDiscrepancies = [];
      let totalRecordsToRestore = 0;

      for (const tableName of SCHEMA_TABLES) {
        const rows = payload.tables[tableName];
        const count = Array.isArray(rows) ? rows.length : 0;
        backupTableCounts[tableName] = count;
        totalRecordsToRestore += count;

        tableDiscrepancies.push({
          tableName,
          description: tableDescriptions[tableName] || tableName,
          currentRows: currentTableCounts[tableName] || 0,
          backupRows: count,
        });
      }

      const missingTables = SCHEMA_TABLES.filter((t) => !Array.isArray(payload.tables[t]));

      res.json({
        valid: true,
        fileFormat: 'json',
        metadata: payload.metadata,
        currentTableCounts,
        backupTableCounts,
        tableDiscrepancies,
        totalRecordsToRestore,
        missingTables,
      });
    } catch (error: any) {
      console.error('Error validating backup:', error);
      res.status(500).json({ valid: false, error: error.message || 'Validation failed' });
    }
  });

  // 6. Execute Full Database Restoration (.sql or .json)
  app.post('/api/database/restore', authMiddleware, async (req: AuthRequest, res) => {
    const startTime = Date.now();
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access Denied: Only Administrator role has authorization to restore the database.' });
      }

      const { backup, snapshotFilename, confirmationKeyword, sqlDump } = req.body;

      if ((confirmationKeyword || '').trim().toUpperCase() !== 'RESTORE') {
        return res.status(400).json({
          error: 'Restoration aborted: You must type "RESTORE" exactly to confirm database replacement.',
        });
      }

      let payload = backup;
      let rawSqlScript: string | null = sqlDump || null;
      let isSqlFormat = false;

      if (snapshotFilename) {
        const snapshotPath = path.join(BACKUPS_DIR, path.basename(snapshotFilename));
        if (fs.existsSync(snapshotPath)) {
          if (snapshotFilename.endsWith('.sql')) {
            rawSqlScript = fs.readFileSync(snapshotPath, 'utf-8');
            isSqlFormat = true;
          } else {
            payload = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
          }
        } else {
          return res.status(404).json({ error: `Snapshot file ${snapshotFilename} not found on server.` });
        }
      } else if (rawSqlScript) {
        isSqlFormat = true;
      }

      // RESTORE MODE A: Native PostgreSQL SQL Script Execution
      if (isSqlFormat && rawSqlScript) {
        // Execute the entire SQL script
        await pool.query(rawSqlScript);

        // Safety Check: Verify that an active Administrator user exists in the database
        const existingAdmins = await db.select().from(users).where(eq(users.role, 'admin'));
        if (existingAdmins.length === 0) {
          const envAdminEmail = (process.env.ADMIN_EMAIL || process.env.ADMIN_USER || 'admin@company.local').trim().toLowerCase();
          const envAdminPass = (process.env.ADMIN_PASSWORD || 'admin123').trim();
          const currentAdminName = req.user?.name || 'System Administrator';
          const currentAdminEmail = req.user?.email || envAdminEmail;
          const currentAdminUid = req.user?.uid || `admin_${Date.now()}`;
          const adminHash = hashPassword(envAdminPass);

          await db.insert(users).values({
            uid: currentAdminUid,
            name: currentAdminName,
            email: currentAdminEmail,
            password: adminHash,
            role: 'admin',
            isActive: true,
          });
        }

        // Gather restored counts per table
        const recordsPerTable: Record<string, number> = {};
        let totalRecordsRestored = 0;
        for (const tableName of SCHEMA_TABLES) {
          const tableObj = TABLE_OBJECTS[tableName];
          if (tableObj) {
            try {
              const countRes = await db.select({ count: sql<number>`count(*)` }).from(tableObj);
              const count = Number(countRes[0]?.count || 0);
              recordsPerTable[tableName] = count;
              totalRecordsRestored += count;
            } catch (_) {
              recordsPerTable[tableName] = 0;
            }
          }
        }

        const durationMs = Date.now() - startTime;
        await logEntry(
          req,
          'RESTORE_DATABASE',
          'SYSTEM_DATABASE',
          totalRecordsRestored,
          `Admin ${req.user.name} restored database successfully from PostgreSQL SQL dump (${totalRecordsRestored} records in ${durationMs}ms)`
        );

        return res.json({
          success: true,
          fileFormat: 'sql',
          message: `PostgreSQL database successfully restored from SQL script! Restored ${totalRecordsRestored} records across tables.`,
          restoredAt: new Date().toISOString(),
          tablesRestored: SCHEMA_TABLES,
          totalRecordsRestored,
          recordsPerTable,
          durationMs,
        });
      }

      // RESTORE MODE B: JSON Table-by-Table Insertion
      if (!payload || !payload.tables || typeof payload.tables !== 'object') {
        return res.status(400).json({ error: 'Invalid backup payload. Expected a valid backup object with "tables" or a SQL script.' });
      }

      // 1. Clear all tables in reverse dependency order
      const reverseOrder = [...RESTORE_ORDER].reverse();
      for (const tableName of reverseOrder) {
        try {
          await pool.query(`DELETE FROM "${tableName}";`);
        } catch (delErr) {
          console.warn(`Could not clear table ${tableName} with DELETE:`, delErr);
        }
      }

      // 2. Insert records in strict dependency order
      const recordsPerTable: Record<string, number> = {};
      const tablesRestored: string[] = [];
      let totalRecordsRestored = 0;

      for (const tableName of RESTORE_ORDER) {
        const rows = payload.tables[tableName];
        const tableObj = TABLE_OBJECTS[tableName];

        if (tableObj && Array.isArray(rows) && rows.length > 0) {
          const chunkSize = 50;
          for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            const prepared = chunk.map((r: any) => {
              const copy: any = {};
              for (const [k, v] of Object.entries(r)) {
                let val = v;
                if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
                  val = new Date(v);
                }
                copy[k] = val;
              }
              // Map snake_case database column names to Drizzle property keys if needed
              for (const [propName, colObj] of Object.entries(tableObj)) {
                if (colObj && typeof colObj === 'object' && 'name' in colObj) {
                  const sqlColName = (colObj as any).name;
                  if (copy[sqlColName] !== undefined && copy[propName] === undefined) {
                    copy[propName] = copy[sqlColName];
                  }
                }
              }
              return copy;
            });
            await db.insert(tableObj).values(prepared);
          }

          recordsPerTable[tableName] = rows.length;
          tablesRestored.push(tableName);
          totalRecordsRestored += rows.length;
        } else {
          recordsPerTable[tableName] = 0;
        }

        // Synchronize sequence identity to prevent ID collision
        try {
          const seqRes = await pool.query(`SELECT pg_get_serial_sequence($1, 'id');`, [tableName]);
          const seqName = seqRes.rows[0]?.pg_get_serial_sequence;
          if (seqName) {
            await pool.query(
              `SELECT setval($1, COALESCE((SELECT MAX(id) FROM "${tableName}"), 0) + 1, false);`,
              [seqName]
            );
          }
        } catch (seqErr) {
          // ignore if no serial id sequence
        }
      }

      // 3. Safety Check: Verify that an active Administrator user exists in the database
      const existingAdmins = await db.select().from(users).where(eq(users.role, 'admin'));
      if (existingAdmins.length === 0) {
        const envAdminEmail = (process.env.ADMIN_EMAIL || process.env.ADMIN_USER || 'admin@company.local').trim().toLowerCase();
        const envAdminPass = (process.env.ADMIN_PASSWORD || 'admin123').trim();
        const currentAdminName = req.user?.name || 'System Administrator';
        const currentAdminEmail = req.user?.email || envAdminEmail;
        const currentAdminUid = req.user?.uid || `admin_${Date.now()}`;
        const adminHash = hashPassword(envAdminPass);

        await db.insert(users).values({
          uid: currentAdminUid,
          name: currentAdminName,
          email: currentAdminEmail,
          password: adminHash,
          role: 'admin',
          isActive: true,
        });
        recordsPerTable['users'] = (recordsPerTable['users'] || 0) + 1;
        totalRecordsRestored += 1;
      }

      // 4. Log the restore action
      const durationMs = Date.now() - startTime;
      await logEntry(
        req,
        'RESTORE_DATABASE',
        'SYSTEM_DATABASE',
        totalRecordsRestored,
        `Admin ${req.user.name} restored database successfully (${totalRecordsRestored} records across ${tablesRestored.length} tables in ${durationMs}ms)`
      );

      res.json({
        success: true,
        fileFormat: 'json',
        message: `Database successfully restored! Populated ${totalRecordsRestored} records across ${tablesRestored.length} tables.`,
        restoredAt: new Date().toISOString(),
        tablesRestored,
        totalRecordsRestored,
        recordsPerTable,
        durationMs,
      });
    } catch (error: any) {
      console.error('Error restoring database:', error);
      res.status(500).json({ error: error.message || 'Failed to restore database' });
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
