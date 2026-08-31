import { db } from './index.ts';
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
} from './schema.ts';
import { eq } from 'drizzle-orm';

export async function seedDatabase() {
  try {
    const existingBranches = await db.select().from(branches);
    if (existingBranches.length > 0) {
      console.log('Database already has data. Skipping full seed.');
      return;
    }

    console.log('Seeding initial data into Cloud SQL PostgreSQL database...');

    // 1. Branches
    const [b1, b2, b3] = await db.insert(branches).values([
      { name: 'Central Plant & HQ', code: 'BR-HQ01', location: 'Building A, Industrial Zone 4', phone: '+1 555-0100' },
      { name: 'West Logistics Hub', code: 'BR-WEST02', location: 'West Port Logistics Center', phone: '+1 555-0200' },
      { name: 'North Assembly Unit', code: 'BR-NORTH03', location: 'Northern Industrial Estate', phone: '+1 555-0300' },
    ]).returning();

    // 2. Departments
    const [d1, d2, d3, d4, d5] = await db.insert(departments).values([
      { branchId: b1.id, name: 'Precision Assembly & Production', code: 'DEP-PROD', floorLocation: 'Floor 1, Shopfloor A' },
      { branchId: b1.id, name: 'Mechanical & Electrical Maintenance', code: 'DEP-MAINT', floorLocation: 'Floor 1, Workshop East' },
      { branchId: b1.id, name: 'Quality Assurance & Testing Lab', code: 'DEP-QA', floorLocation: 'Floor 2, Cleanroom Lab' },
      { branchId: b2.id, name: 'Warehouse & Shipping', code: 'DEP-SHIP', floorLocation: 'Dock Bay 1-6' },
      { branchId: b3.id, name: 'Fabrication & Tooling', code: 'DEP-FAB', floorLocation: 'Ground Floor Tooling Bay' },
    ]).returning();

    // 3. Locations & Sublocations
    const [loc1, loc2, loc3] = await db.insert(locations).values([
      { branchId: b1.id, departmentId: d1.id, name: 'Shop Floor Bay A1', type: 'room' },
      { branchId: b1.id, departmentId: d2.id, name: 'Tool Crib & Spare Parts Rack', type: 'storage' },
      { branchId: b1.id, departmentId: d3.id, name: 'Calibration Bench 2', type: 'shelf' },
      { branchId: b2.id, departmentId: d4.id, name: 'Aisle 04 Bulk Rack', type: 'rack' },
    ]).returning();

    // 4. Machines (Acting as request destination locations in departments)
    const [m1, m2, m3, m4] = await db.insert(machines).values([
      { branchId: b1.id, departmentId: d1.id, name: '5-Axis CNC Milling Center', machineCode: 'MCH-CNC-501', model: 'DMG Mori CMX-50V', status: 'active' },
      { branchId: b1.id, departmentId: d1.id, name: 'High-Speed Automated Packaging Line 2', machineCode: 'MCH-PKG-002', model: 'Tetra Matrix 400', status: 'active' },
      { branchId: b1.id, departmentId: d2.id, name: 'Industrial Hydraulic Press 50 Ton', machineCode: 'MCH-PRS-050', model: 'Enerpac H-50', status: 'active' },
      { branchId: b1.id, departmentId: d1.id, name: 'Fiber Laser Cutting Machine', machineCode: 'MCH-LSR-012', model: 'Bystronic BySprint', status: 'maintenance' },
    ]).returning();

    // 5. Categories
    const [cAsset1, cAsset2, cAsset3, cCons1, cCons2, cCons3] = await db.insert(categories).values([
      { name: 'Heavy Machinery & Production Equipment', code: 'CAT-MACH', type: 'asset', description: 'Major manufacturing equipment, CNCs, and presses' },
      { name: 'Precision Diagnostic & Testing Tools', code: 'CAT-DIAG', type: 'asset', description: 'Calibrated gauges, laser meters, oscilloscopes' },
      { name: 'Powered Hand Tools & Equipment', code: 'CAT-TOOL', type: 'asset', description: 'Rotary hammers, torque drills, grinders' },
      { name: 'Industrial Lubricants & Fluids', code: 'CAT-LUB', type: 'consumable', description: 'Hydraulic oils, greases, coolants, degreasers' },
      { name: 'Fasteners, Seals & O-Rings', code: 'CAT-FAST', type: 'consumable', description: 'Bolts, nuts, high-temp silicone seals, O-rings' },
      { name: 'Safety & PPE Consumables', code: 'CAT-PPE', type: 'consumable', description: 'N95 respirators, Kevlar gloves, earplugs' },
    ]).returning();

    // 6. Custom Fields under categories
    const [cf1, cf2, cf3, cf4, cf5, cf6] = await db.insert(customFields).values([
      { categoryId: cAsset1.id, name: 'voltage_rating', label: 'Operating Voltage (V)', fieldType: 'dropdown', options: ['110V AC', '220V AC', '380V 3-Phase', '480V 3-Phase'], isRequired: true },
      { categoryId: cAsset1.id, name: 'max_operating_pressure', label: 'Max Operating Pressure (Bar)', fieldType: 'number', isRequired: false },
      { categoryId: cAsset1.id, name: 'calibration_interval', label: 'Inspection Frequency', fieldType: 'dropdown', options: ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual'], isRequired: true },
      { categoryId: cCons1.id, name: 'viscosity_grade', label: 'ISO Viscosity Grade', fieldType: 'dropdown', options: ['ISO VG 32', 'ISO VG 46', 'ISO VG 68', 'ISO VG 220'], isRequired: true },
      { categoryId: cCons1.id, name: 'hazard_rating', label: 'Chemical Hazard Level', fieldType: 'radio', options: ['Low / Non-Hazardous', 'Flammable Class 2', 'Corrosive'], isRequired: true },
      { categoryId: cCons1.id, name: 'flash_point', label: 'Flash Point (°C)', fieldType: 'number', isRequired: false },
    ]).returning();

    // 7. Field Sets
    const [fs1, fs2] = await db.insert(fieldSets).values([
      { categoryId: cAsset1.id, name: 'Industrial Machinery Technical Specification', description: 'Standard electrical and mechanical properties for heavy assets' },
      { categoryId: cCons1.id, name: 'Chemical Fluid & Safety Matrix', description: 'Safety, viscosity, and storage parameters' },
    ]).returning();

    // Field Set Items
    await db.insert(fieldSetItems).values([
      { fieldSetId: fs1.id, customFieldId: cf1.id, displayOrder: 1 },
      { fieldSetId: fs1.id, customFieldId: cf2.id, displayOrder: 2 },
      { fieldSetId: fs1.id, customFieldId: cf3.id, displayOrder: 3 },
      { fieldSetId: fs2.id, customFieldId: cf4.id, displayOrder: 1 },
      { fieldSetId: fs2.id, customFieldId: cf5.id, displayOrder: 2 },
      { fieldSetId: fs2.id, customFieldId: cf6.id, displayOrder: 3 },
    ]);

    // 8. Models
    const [mod1, mod2, mod3, mod4] = await db.insert(models).values([
      { categoryId: cAsset1.id, fieldSetId: fs1.id, name: 'DMG Mori CMX-50V CNC', modelNumber: 'MOD-CMX-50V', manufacturer: 'DMG MORI GmbH', description: 'High precision 5-axis vertical machining center' },
      { categoryId: cAsset3.id, fieldSetId: null, name: 'Bosch GBH 8-45 Professional Rotary Hammer', modelNumber: 'MOD-GBH-845', manufacturer: 'Bosch Power Tools', description: 'Heavy duty SDS-max hammer' },
      { categoryId: cCons1.id, fieldSetId: fs2.id, name: 'Mobil Vactra Heavy Medium Oil', modelNumber: 'MOD-MOB-VAC2', manufacturer: 'ExxonMobil Corp', description: 'Premium slide-way lubricant' },
      { categoryId: cCons3.id, fieldSetId: null, name: '3M Aura Particulate Respirator 9320+', modelNumber: 'MOD-3M-9320', manufacturer: '3M Industrial Safety', description: 'FFP2 / N95 disposable respirator pack' },
    ]).returning();

    // 9. Vendors
    const [v1, v2, v3] = await db.insert(vendors).values([
      { branchId: b1.id, name: 'Apex Engineering & Calibration Services', contactPerson: 'Jonathan Vance', email: 'service@apexengineering.com', phone: '+1 555-7801', address: '44 Machine Way, Metro Industrial Park', serviceType: 'supplier_and_repair' },
      { branchId: b2.id, name: 'Precision Hydraulics Overhaul Labs', contactPerson: 'Elena Rodriguez', email: 'repairs@precisionhydraulics.net', phone: '+1 555-7802', address: '12 Pressure Blvd, West City', serviceType: 'repair' },
      { branchId: b3.id, name: 'Global Industrial Polymers & Fasteners Corp', contactPerson: 'David Ross', email: 'orders@globalfasteners.com', phone: '+1 555-7803', address: '900 Global Trade Parkway', serviceType: 'supplier' },
    ]).returning();

    // 9b. Vendor Branch Assignments (Admin allows other branches to view/use vendors)
    await db.insert(vendorBranchAssignments).values([
      { vendorId: v1.id, branchId: b2.id, grantedByUserId: 1 },
      { vendorId: v3.id, branchId: b1.id, grantedByUserId: 1 },
    ]);

    // 10. Pre-fed Request Reasons
    const [r1, r2, r3, r4, r5] = await db.insert(requestReasons).values([
      { reason: 'Routine Scheduled Maintenance', categoryType: 'all', isActive: true },
      { reason: 'Emergency Machine Breakdown Repair', categoryType: 'all', isActive: true },
      { reason: 'Tool Wear Out / Replacement', categoryType: 'asset', isActive: true },
      { reason: 'Weekly Batch Production Consumable Refill', categoryType: 'consumable', isActive: true },
      { reason: 'Quality Assurance Testing & Calibration', categoryType: 'all', isActive: true },
      { reason: 'Spill Containment & Urgent Safety Measure', categoryType: 'consumable', isActive: true },
    ]).returning();

    // 11. Employees
    const [emp1, emp2, emp3, emp4] = await db.insert(employees).values([
      { name: 'David Miller', employeeCode: 'EMP-1001', branchId: b1.id, userCode: '1001', phone: '+1 555-1001', email: 'david.miller@company.local' },
      { name: 'Sarah Chen', employeeCode: 'EMP-1002', branchId: b1.id, userCode: '1002', phone: '+1 555-1002', email: 'sarah.chen@company.local' },
      { name: 'Marcus Vance', employeeCode: 'EMP-1003', branchId: b1.id, userCode: '1003', phone: '+1 555-1003', email: 'marcus.vance@company.local' },
      { name: 'Elena Rostova', employeeCode: 'EMP-1004', branchId: b1.id, userCode: '1004', phone: '+1 555-1004', email: 'elena.rostova@company.local' },
    ]).returning();

    // Employee Department Linking
    await db.insert(employeeDepartments).values([
      { employeeId: emp1.id, departmentId: d1.id, isPrimary: true },
      { employeeId: emp1.id, departmentId: d2.id, isPrimary: false },
      { employeeId: emp2.id, departmentId: d2.id, isPrimary: true },
      { employeeId: emp3.id, departmentId: d3.id, isPrimary: true },
      { employeeId: emp4.id, departmentId: d1.id, isPrimary: true },
    ]);

    // 12. Users
    await db.insert(users).values([
      { uid: 'admin-001', email: 'admin@company.local', password: 'admin', name: 'Arthur Pendelton', role: 'admin', branchId: b1.id, departmentId: d1.id, userCode: '9999' },
      { uid: 'super-001', email: 'super@company.local', password: 'super', name: 'Claire Sterling', role: 'super_manager', branchId: b1.id, departmentId: d1.id, userCode: '8888' },
      { uid: 'mgr-001', email: 'manager.hq@company.local', password: 'manager', name: 'Robert Fox', role: 'manager', branchId: b1.id, departmentId: d1.id, userCode: '7777' },
      { uid: 'dept-001', email: 'dept.prod@company.local', password: 'dept', name: 'Assembly Dept Terminal', role: 'department', branchId: b1.id, departmentId: d1.id, userCode: '1001' },
    ]);

    // Permissions for Super Manager and Manager
    await db.insert(userCategoryPermissions).values([
      { userId: 2, categoryId: cAsset1.id, canManage: true },
      { userId: 2, categoryId: cAsset2.id, canManage: true },
      { userId: 2, categoryId: cAsset3.id, canManage: true },
      { userId: 2, categoryId: cCons1.id, canManage: true },
      { userId: 2, categoryId: cCons2.id, canManage: true },
      { userId: 2, categoryId: cCons3.id, canManage: true },
      { userId: 3, categoryId: cAsset1.id, canManage: true },
      { userId: 3, categoryId: cCons1.id, canManage: true },
    ]);

    // 13. Inventory Items (Assets and Consumables in various UOMs)
    const [it1, it2, it3, it4, it5] = await db.insert(inventoryItems).values([
      {
        code: 'AST-CNC-2024-01',
        name: 'DMG Mori 5-Axis Milling Unit Alpha',
        itemType: 'asset',
        categoryId: cAsset1.id,
        modelId: mod1.id,
        supplierId: v1.id,
        uom: 'unit',
        totalQuantity: 2,
        availableQuantity: 2,
        minThreshold: 1,
        recordDate: '2026-01-15',
        status: 'available',
        customFieldsData: {
          voltage_rating: '380V 3-Phase',
          max_operating_pressure: 120,
          calibration_interval: 'Quarterly',
        },
        notes: 'Primary milling station installed at Shop Floor Bay A1.',
        engagementStatus: 'engaged',
        firstEngagedAt: new Date(Date.now() - 45 * 86400000), // 45 days ago
        lastEngagedAt: new Date(),
        totalEngagementMinutes: 45 * 24 * 60,
      },
      {
        code: 'AST-HAM-2024-09',
        name: 'Bosch SDS-Max Rotary Hammer #09',
        itemType: 'asset',
        categoryId: cAsset3.id,
        modelId: mod2.id,
        supplierId: v1.id,
        uom: 'unit',
        totalQuantity: 6,
        availableQuantity: 4,
        minThreshold: 2,
        recordDate: '2026-02-10',
        status: 'available',
        customFieldsData: {},
        notes: 'Heavy concrete anchoring and tooling.',
        engagementStatus: 'idle',
        totalEngagementMinutes: 120 * 60,
      },
      {
        code: 'CON-LUB-MOB-200L',
        name: 'Mobil Vactra Slideway Oil No. 2',
        itemType: 'consumable',
        categoryId: cCons1.id,
        modelId: mod3.id,
        supplierId: v1.id,
        uom: 'liter',
        totalQuantity: 250,
        availableQuantity: 35, // Low stock!
        minThreshold: 50,
        recordDate: '2026-03-01',
        status: 'low_stock',
        customFieldsData: {
          viscosity_grade: 'ISO VG 68',
          hazard_rating: 'Low / Non-Hazardous',
          flash_point: 228,
        },
        notes: 'Urgent reorder required - below 50 Liters threshold.',
      },
      {
        code: 'CON-PPE-N95-BX',
        name: '3M Aura FFP2 / N95 Respirators (Box of 20)',
        itemType: 'consumable',
        categoryId: cCons3.id,
        modelId: mod4.id,
        supplierId: v3.id,
        uom: 'package',
        totalQuantity: 100,
        availableQuantity: 18, // Low stock warning
        minThreshold: 25,
        recordDate: '2026-03-05',
        status: 'low_stock',
        customFieldsData: {},
        notes: 'Cleanroom and particulate filtration mask packs.',
      },
      {
        code: 'CON-SEAL-NBR-ROLL',
        name: 'Nitrile High-Grade Rubber Gasket Cord',
        itemType: 'consumable',
        categoryId: cCons2.id,
        modelId: null,
        supplierId: v3.id,
        uom: 'meter',
        totalQuantity: 500,
        availableQuantity: 320,
        minThreshold: 60,
        recordDate: '2026-02-20',
        status: 'available',
        customFieldsData: {},
        notes: '5mm diameter continuous roll for sealing chambers.',
      },
    ]).returning();

    // 14. Stock Locations (Quantities per location and machine)
    await db.insert(stockLocations).values([
      { itemId: it1.id, branchId: b1.id, departmentId: d1.id, locationId: loc1.id, machineId: m1.id, quantity: 1 },
      { itemId: it1.id, branchId: b1.id, departmentId: d1.id, locationId: loc1.id, machineId: null, quantity: 1 },
      { itemId: it2.id, branchId: b1.id, departmentId: d2.id, locationId: loc2.id, machineId: null, quantity: 4 },
      { itemId: it3.id, branchId: b1.id, departmentId: d1.id, locationId: loc1.id, machineId: m1.id, quantity: 20 },
      { itemId: it3.id, branchId: b1.id, departmentId: d2.id, locationId: loc2.id, machineId: m3.id, quantity: 15 },
      { itemId: it4.id, branchId: b1.id, departmentId: d3.id, locationId: loc3.id, machineId: null, quantity: 18 },
      { itemId: it5.id, branchId: b1.id, departmentId: d1.id, locationId: loc1.id, machineId: null, quantity: 320 },
    ]);

    // 15. Employee Requests
    await db.insert(employeeRequests).values([
      {
        requestId: 'REQ-2026-001',
        employeeId: emp1.id,
        branchId: b1.id,
        departmentId: d1.id,
        itemId: it3.id,
        requestedQty: 10,
        uom: 'liter',
        reasonId: r4.id,
        reasonText: 'Weekly Batch Production Consumable Refill',
        machineId: m1.id,
        securityPinEntered: '1001',
        status: 'issued',
        requestedAt: new Date(Date.now() - 3600000 * 24),
        issuedAt: new Date(Date.now() - 3600000 * 20),
        issuedByUserId: 3,
        managerNotes: 'Issued 10 Liters to CNC station.',
      },
      {
        requestId: 'REQ-2026-002',
        employeeId: emp2.id,
        branchId: b1.id,
        departmentId: d2.id,
        itemId: it2.id,
        requestedQty: 1,
        uom: 'unit',
        reasonId: r2.id,
        reasonText: 'Emergency Machine Breakdown Repair',
        machineId: m3.id,
        securityPinEntered: '1002',
        status: 'pending',
        requestedAt: new Date(),
        managerNotes: null,
      },
    ]);

    // 16. Vendor Repairs (Engagement tracking before repair/trash)
    await db.insert(vendorRepairs).values([
      {
        itemId: it2.id,
        vendorId: v1.id,
        branchId: b1.id,
        sentDate: '2026-02-15',
        expectedReturnDate: '2026-03-02',
        returnedDate: null,
        issueDescription: 'Clutch mechanism slipping under load and motor brushes worn out.',
        repairCost: 145.50,
        status: 'sent_to_vendor',
        engagedDurationMinutes: 180 * 24 * 60, // Engaged for 180 days before repair
        managerNotes: 'Asset was heavily engaged on maintenance operations before gearbox slipped.',
      },
    ]);

    // 17. Entry Logs / Audit Trail
    await db.insert(entryLogs).values([
      {
        userId: 1,
        userName: 'Arthur Pendelton (Admin)',
        userRole: 'admin',
        branchId: b1.id,
        action: 'INITIALIZE_SYSTEM',
        entityType: 'system',
        entityId: 'SYS-INIT',
        details: 'Initial branches, departments, categories, and UOM standards configured.',
        createdAt: new Date(Date.now() - 86400000 * 5),
      },
      {
        userId: 2,
        userName: 'Claire Sterling (Super Manager)',
        userRole: 'super_manager',
        branchId: b1.id,
        action: 'CREATE_MODEL_AND_FIELDS',
        entityType: 'model',
        entityId: 'MOD-CMX-50V',
        details: 'Created DMG Mori CNC model and associated Machine Specifications field set.',
        createdAt: new Date(Date.now() - 86400000 * 3),
      },
      {
        userId: 3,
        userName: 'Robert Fox (Manager)',
        userRole: 'manager',
        branchId: b1.id,
        action: 'ISSUE_REQUEST',
        entityType: 'request',
        entityId: 'REQ-2026-001',
        details: 'Issued 10 Liters of Mobil Vactra Oil to Employee David Miller for CNC-501.',
        createdAt: new Date(Date.now() - 3600000 * 20),
      },
    ]);

    console.log('Database seeding successfully completed.');
  } catch (error) {
    console.error('Error during database seed:', error);
  }
}
