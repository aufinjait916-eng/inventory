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
import { hashPassword } from '../lib/auth-crypto.ts';

export async function seedDatabase(force = false) {
  try {
    if (!force) {
      const existingBranches = await db.select().from(branches);
      if (existingBranches.length > 0) {
        console.log('Database already has data. Skipping automatic seed.');
        return;
      }
    } else {
      console.log('Force re-seeding database with complete sample dataset...');
      // Clean up existing tables in reverse dependency order
      await db.delete(entryLogs);
      await db.delete(vendorRepairs);
      await db.delete(inventoryMovements);
      await db.delete(employeeRequests);
      await db.delete(stockLocations);
      await db.delete(inventoryItems);
      await db.delete(vendorBranchAssignments);
      await db.delete(vendors);
      await db.delete(models);
      await db.delete(fieldSetItems);
      await db.delete(fieldSets);
      await db.delete(customFields);
      await db.delete(userCategoryPermissions);
      await db.delete(users);
      await db.delete(employeeDepartments);
      await db.delete(employees);
      await db.delete(requestReasons);
      await db.delete(machines);
      await db.delete(locations);
      await db.delete(departments);
      await db.delete(categories);
      await db.delete(branches);
    }

    console.log('Seeding rich production-ready sample records into Cloud SQL PostgreSQL database...');

    // 1. Branches
    const [b1, b2, b3, b4] = await db.insert(branches).values([
      { name: 'Central Plant & HQ', code: 'BR-HQ01', location: 'Building A, Metro Industrial Zone 4', phone: '+1 555-0100' },
      { name: 'West Logistics Hub', code: 'BR-WEST02', location: 'West Port Logistics Center, Bay 12', phone: '+1 555-0200' },
      { name: 'North Assembly Unit', code: 'BR-NORTH03', location: 'Northern Industrial Estate, Sector 7', phone: '+1 555-0300' },
      { name: 'East Processing Terminal', code: 'BR-EAST04', location: 'Eastern Freight & Tech Hub, Bldg 3', phone: '+1 555-0400' },
    ]).returning();

    // 2. Departments
    const [d1, d2, d3, d4, d5, d6] = await db.insert(departments).values([
      { branchId: b1.id, name: 'Precision Assembly & Production', code: 'DEP-PROD', floorLocation: 'Floor 1, Shopfloor A' },
      { branchId: b1.id, name: 'Mechanical & Electrical Maintenance', code: 'DEP-MAINT', floorLocation: 'Floor 1, Workshop East' },
      { branchId: b1.id, name: 'Quality Assurance & Testing Lab', code: 'DEP-QA', floorLocation: 'Floor 2, Cleanroom Lab' },
      { branchId: b2.id, name: 'Warehouse & Shipping Logistics', code: 'DEP-SHIP', floorLocation: 'Dock Bays 1-8' },
      { branchId: b3.id, name: 'Fabrication & Tooling Workshop', code: 'DEP-FAB', floorLocation: 'Ground Floor Tooling Bay' },
      { branchId: b1.id, name: 'Chemical Processing & Fluids Bay', code: 'DEP-CHEM', floorLocation: 'Hazardous Materials Containment Bay' },
    ]).returning();

    // 3. Locations & Sublocations
    const [loc1, loc2, loc3, loc4, loc5, loc6] = await db.insert(locations).values([
      { branchId: b1.id, departmentId: d1.id, name: 'Shop Floor Bay A1', type: 'room' },
      { branchId: b1.id, departmentId: d2.id, name: 'Tool Crib & Spare Parts Rack', type: 'storage' },
      { branchId: b1.id, departmentId: d3.id, name: 'Calibration Bench 2', type: 'shelf' },
      { branchId: b2.id, departmentId: d4.id, name: 'Aisle 04 Bulk Pallet Rack', type: 'rack' },
      { branchId: b1.id, departmentId: d6.id, name: 'Flammable Storage Cabinet B3', type: 'storage' },
      { branchId: b3.id, departmentId: d5.id, name: 'Heavy Tooling Rack T1', type: 'rack' },
    ]).returning();

    // 4. Machines (Acting as request destination locations in departments)
    const [m1, m2, m3, m4, m5, m6] = await db.insert(machines).values([
      { branchId: b1.id, departmentId: d1.id, name: '5-Axis CNC Milling Center', machineCode: 'MCH-CNC-501', model: 'DMG Mori CMX-50V', status: 'active' },
      { branchId: b1.id, departmentId: d1.id, name: 'High-Speed Automated Packaging Line 2', machineCode: 'MCH-PKG-002', model: 'Tetra Matrix 400', status: 'active' },
      { branchId: b1.id, departmentId: d2.id, name: 'Industrial Hydraulic Press 50 Ton', machineCode: 'MCH-PRS-050', model: 'Enerpac H-50', status: 'active' },
      { branchId: b1.id, departmentId: d1.id, name: 'Fiber Laser Cutting Machine', machineCode: 'MCH-LSR-012', model: 'Bystronic BySprint', status: 'maintenance' },
      { branchId: b3.id, departmentId: d5.id, name: 'Automated SMT Pick & Place Machine', machineCode: 'MCH-SMT-108', model: 'Yamaha YSM20R', status: 'active' },
      { branchId: b1.id, departmentId: d2.id, name: 'Robotic Welding Cell B', machineCode: 'MCH-ROB-004', model: 'KUKA KR Cybertech', status: 'active' },
    ]).returning();

    // 5. Categories (Assets & Consumables)
    const [cAsset1, cAsset2, cAsset3, cCons1, cCons2, cCons3, cCons4] = await db.insert(categories).values([
      { name: 'Heavy Machinery & Production Equipment', code: 'CAT-MACH', type: 'asset', description: 'Major manufacturing equipment, CNCs, robotic arms and presses' },
      { name: 'Precision Diagnostic & Testing Tools', code: 'CAT-DIAG', type: 'asset', description: 'Calibrated gauges, laser meters, oscilloscopes and multimeters' },
      { name: 'Powered Hand Tools & Equipment', code: 'CAT-TOOL', type: 'asset', description: 'Rotary hammers, torque drills, grinders and pneumatic wrenches' },
      { name: 'Industrial Lubricants & Fluids', code: 'CAT-LUB', type: 'consumable', description: 'Hydraulic oils, slideway greases, synthetic coolants, degreasers' },
      { name: 'Fasteners, Seals & O-Rings', code: 'CAT-FAST', type: 'consumable', description: 'High-tensile bolts, flange gaskets, high-temp silicone seals, O-rings' },
      { name: 'Safety & PPE Consumables', code: 'CAT-PPE', type: 'consumable', description: 'N95 respirators, Kevlar cut-resistant gloves, earplugs, eye shields' },
      { name: 'Chemicals, Adhesives & Threadlockers', code: 'CAT-CHEM', type: 'consumable', description: 'Anaerobic adhesives, thread sealants, industrial epoxies' },
    ]).returning();

    // 6. Custom Fields under categories
    const [cf1, cf2, cf3, cf4, cf5, cf6, cf7, cf8] = await db.insert(customFields).values([
      { categoryId: cAsset1.id, name: 'voltage_rating', label: 'Operating Voltage (V)', fieldType: 'dropdown', options: ['110V AC', '220V AC', '380V 3-Phase', '480V 3-Phase'], isRequired: true },
      { categoryId: cAsset1.id, name: 'max_operating_pressure', label: 'Max Operating Pressure (Bar)', fieldType: 'number', isRequired: false },
      { categoryId: cAsset1.id, name: 'calibration_interval', label: 'Inspection Frequency', fieldType: 'dropdown', options: ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual'], isRequired: true },
      { categoryId: cAsset2.id, name: 'accuracy_class', label: 'Accuracy Rating / Tolerance', fieldType: 'text', isRequired: true },
      { categoryId: cCons1.id, name: 'viscosity_grade', label: 'ISO Viscosity Grade', fieldType: 'dropdown', options: ['ISO VG 32', 'ISO VG 46', 'ISO VG 68', 'ISO VG 220'], isRequired: true },
      { categoryId: cCons1.id, name: 'hazard_rating', label: 'Chemical Hazard Level', fieldType: 'radio', options: ['Low / Non-Hazardous', 'Flammable Class 2', 'Corrosive'], isRequired: true },
      { categoryId: cCons1.id, name: 'flash_point', label: 'Flash Point (°C)', fieldType: 'number', isRequired: false },
      { categoryId: cCons4.id, name: 'cure_time', label: 'Full Cure Time (Hours)', fieldType: 'number', isRequired: false },
    ]).returning();

    // 7. Field Sets
    const [fs1, fs2, fs3] = await db.insert(fieldSets).values([
      { categoryId: cAsset1.id, name: 'Industrial Machinery Technical Specification', description: 'Standard electrical and mechanical properties for heavy assets' },
      { categoryId: cCons1.id, name: 'Chemical Fluid & Safety Matrix', description: 'Safety, viscosity, and storage parameters' },
      { categoryId: cAsset2.id, name: 'Precision Calibration Standards', description: 'Testing accuracy and calibration tracking parameters' },
    ]).returning();

    // Field Set Items
    await db.insert(fieldSetItems).values([
      { fieldSetId: fs1.id, customFieldId: cf1.id, displayOrder: 1 },
      { fieldSetId: fs1.id, customFieldId: cf2.id, displayOrder: 2 },
      { fieldSetId: fs1.id, customFieldId: cf3.id, displayOrder: 3 },
      { fieldSetId: fs2.id, customFieldId: cf5.id, displayOrder: 1 },
      { fieldSetId: fs2.id, customFieldId: cf6.id, displayOrder: 2 },
      { fieldSetId: fs2.id, customFieldId: cf7.id, displayOrder: 3 },
      { fieldSetId: fs3.id, customFieldId: cf4.id, displayOrder: 1 },
    ]);

    // 8. Models (Configured with dedicated Low Stock Thresholds)
    const [mod1, mod2, mod3, mod4, mod5, mod6, mod7] = await db.insert(models).values([
      { categoryId: cAsset1.id, fieldSetId: fs1.id, name: 'DMG Mori CMX-50V CNC', modelNumber: 'MOD-CMX-50V', minThreshold: 2, manufacturer: 'DMG MORI GmbH', description: 'High precision 5-axis vertical machining center' },
      { categoryId: cAsset3.id, fieldSetId: null, name: 'Bosch GBH 8-45 Professional Rotary Hammer', modelNumber: 'MOD-GBH-845', minThreshold: 3, manufacturer: 'Bosch Power Tools', description: 'Heavy duty SDS-max rotary hammer' },
      { categoryId: cAsset2.id, fieldSetId: fs3.id, name: 'Fluke 87V Industrial True-RMS Multimeter', modelNumber: 'MOD-FLK-87V', minThreshold: 4, manufacturer: 'Fluke Corporation', description: 'Precision electronic diagnostic meter' },
      { categoryId: cCons1.id, fieldSetId: fs2.id, name: 'Mobil Vactra Heavy Medium Slideway Oil', modelNumber: 'MOD-MOB-VAC2', minThreshold: 50, manufacturer: 'ExxonMobil Corp', description: 'Premium slide-way lubricant with anti-stick slip properties' },
      { categoryId: cCons3.id, fieldSetId: null, name: '3M Aura Particulate Respirator 9320+ FFP2', modelNumber: 'MOD-3M-9320', minThreshold: 30, manufacturer: '3M Industrial Safety', description: 'FFP2 / N95 disposable respirator pack' },
      { categoryId: cCons4.id, fieldSetId: null, name: 'Loctite 243 Medium Strength Threadlocker', modelNumber: 'MOD-LOC-243', minThreshold: 15, manufacturer: 'Henkel AG', description: 'Anaerobic threadlocking compound 50ml' },
      { categoryId: cCons2.id, fieldSetId: null, name: 'SKF Deep Groove Ball Bearing 6205-2RSH', modelNumber: 'MOD-SKF-6205', minThreshold: 25, manufacturer: 'SKF Group', description: 'Sealed radial ball bearing for motors and pumps' },
    ]).returning();

    // 9. Vendors
    const [v1, v2, v3, v4] = await db.insert(vendors).values([
      { branchId: b1.id, name: 'Apex Engineering & Calibration Services', contactPerson: 'Jonathan Vance', email: 'service@apexengineering.com', phone: '+1 555-7801', address: '44 Machine Way, Metro Industrial Park', serviceType: 'supplier_and_repair' },
      { branchId: b2.id, name: 'Precision Hydraulics Overhaul Labs', contactPerson: 'Elena Rodriguez', email: 'repairs@precisionhydraulics.net', phone: '+1 555-7802', address: '12 Pressure Blvd, West City', serviceType: 'repair' },
      { branchId: b3.id, name: 'Global Industrial Polymers & Fasteners Corp', contactPerson: 'David Ross', email: 'orders@globalfasteners.com', phone: '+1 555-7803', address: '900 Global Trade Parkway', serviceType: 'supplier' },
      { branchId: b1.id, name: 'Fluke Certified Metrology & Calibration Labs', contactPerson: 'Sarah Jenkins', email: 'service@flukecal.com', phone: '+1 555-7804', address: '77 Test Bench Blvd, North Hub', serviceType: 'supplier_and_repair' },
    ]).returning();

    // 9b. Vendor Branch Assignments (Cross-branch access permissions)
    await db.insert(vendorBranchAssignments).values([
      { vendorId: v1.id, branchId: b2.id, grantedByUserId: 1 },
      { vendorId: v1.id, branchId: b3.id, grantedByUserId: 1 },
      { vendorId: v3.id, branchId: b1.id, grantedByUserId: 1 },
      { vendorId: v4.id, branchId: b2.id, grantedByUserId: 1 },
    ]);

    // 10. Pre-fed Request Reasons
    const [r1, r2, r3, r4, r5, r6] = await db.insert(requestReasons).values([
      { reason: 'Routine Scheduled Maintenance', categoryType: 'all', isActive: true },
      { reason: 'Emergency Machine Breakdown Repair', categoryType: 'all', isActive: true },
      { reason: 'Tool Wear Out / Replacement', categoryType: 'asset', isActive: true },
      { reason: 'Weekly Batch Production Consumable Refill', categoryType: 'consumable', isActive: true },
      { reason: 'Quality Assurance Testing & Calibration', categoryType: 'all', isActive: true },
      { reason: 'Spill Containment & Urgent Safety Measure', categoryType: 'consumable', isActive: true },
    ]).returning();

    // 11. Employees
    const [emp1, emp2, emp3, emp4, emp5, emp6] = await db.insert(employees).values([
      { name: 'David Miller', employeeCode: 'EMP-1001', branchId: b1.id, userCode: '1001', phone: '+1 555-1001', email: 'david.miller@company.local' },
      { name: 'Sarah Chen', employeeCode: 'EMP-1002', branchId: b1.id, userCode: '1002', phone: '+1 555-1002', email: 'sarah.chen@company.local' },
      { name: 'Marcus Vance', employeeCode: 'EMP-1003', branchId: b1.id, userCode: '1003', phone: '+1 555-1003', email: 'marcus.vance@company.local' },
      { name: 'Elena Rostova', employeeCode: 'EMP-1004', branchId: b1.id, userCode: '1004', phone: '+1 555-1004', email: 'elena.rostova@company.local' },
      { name: 'James Peterson', employeeCode: 'EMP-1005', branchId: b2.id, userCode: '1005', phone: '+1 555-1005', email: 'james.peterson@company.local' },
      { name: 'Aoi Takahashi', employeeCode: 'EMP-1006', branchId: b3.id, userCode: '1006', phone: '+1 555-1006', email: 'aoi.takahashi@company.local' },
    ]).returning();

    // Employee Department Linking
    await db.insert(employeeDepartments).values([
      { employeeId: emp1.id, departmentId: d1.id, isPrimary: true },
      { employeeId: emp1.id, departmentId: d2.id, isPrimary: false },
      { employeeId: emp2.id, departmentId: d2.id, isPrimary: true },
      { employeeId: emp3.id, departmentId: d3.id, isPrimary: true },
      { employeeId: emp4.id, departmentId: d1.id, isPrimary: true },
      { employeeId: emp5.id, departmentId: d4.id, isPrimary: true },
      { employeeId: emp6.id, departmentId: d5.id, isPrimary: true },
    ]);

    // 12. Users
    const [uAdmin, uSuper, uMgr1, uDept1] = await db.insert(users).values([
      { uid: 'admin-001', email: 'admin@company.local', password: hashPassword('admin'), name: 'Arthur Pendelton', role: 'admin', branchId: b1.id, departmentId: d1.id, userCode: '9999' },
      { uid: 'super-001', email: 'super@company.local', password: hashPassword('super'), name: 'Claire Sterling', role: 'super_manager', branchId: b1.id, departmentId: d1.id, userCode: '8888' },
      { uid: 'mgr-001', email: 'manager.hq@company.local', password: hashPassword('manager'), name: 'Robert Fox', role: 'manager', branchId: b1.id, departmentId: d1.id, userCode: '7777' },
      { uid: 'dept-001', email: 'dept.prod@company.local', password: hashPassword('dept'), name: 'Assembly Dept Terminal', role: 'department', branchId: b1.id, departmentId: d1.id, userCode: '1001' },
    ]).returning();

    // Permissions for Super Manager and Manager
    await db.insert(userCategoryPermissions).values([
      { userId: uSuper.id, categoryId: cAsset1.id, canManage: true },
      { userId: uSuper.id, categoryId: cAsset2.id, canManage: true },
      { userId: uSuper.id, categoryId: cAsset3.id, canManage: true },
      { userId: uSuper.id, categoryId: cCons1.id, canManage: true },
      { userId: uSuper.id, categoryId: cCons2.id, canManage: true },
      { userId: uSuper.id, categoryId: cCons3.id, canManage: true },
      { userId: uSuper.id, categoryId: cCons4.id, canManage: true },
      { userId: uMgr1.id, categoryId: cAsset1.id, canManage: true },
      { userId: uMgr1.id, categoryId: cCons1.id, canManage: true },
      { userId: uMgr1.id, categoryId: cCons3.id, canManage: true },
    ]);

    // 13. Inventory Items
    // Assets: Quantity = 1 strictly per individual asset item record
    // Consumables: Batch quantities
    const [itAsset1, itAsset2, itAsset3, itAsset4, itAsset5, itAsset6, itCons1, itCons2, itCons3, itCons4, itCons5] = await db.insert(inventoryItems).values([
      // Asset 1: DMG Mori CNC Machine #01 (Model threshold = 2, total available = 2)
      {
        code: 'AST-CNC-2024-001',
        name: 'DMG Mori 5-Axis Milling Unit Alpha-01',
        itemType: 'asset',
        categoryId: cAsset1.id,
        modelId: mod1.id,
        supplierId: v1.id,
        uom: 'unit',
        totalQuantity: 1,
        availableQuantity: 1,
        minThreshold: 2,
        recordDate: '2026-01-10',
        status: 'available',
        customFieldsData: {
          voltage_rating: '380V 3-Phase',
          max_operating_pressure: 120,
          calibration_interval: 'Quarterly',
        },
        notes: 'Primary milling station installed at Shop Floor Bay A1.',
        engagementStatus: 'engaged',
        firstEngagedAt: new Date(Date.now() - 60 * 86400000),
        lastEngagedAt: new Date(),
        totalEngagementMinutes: 60 * 24 * 60,
      },
      // Asset 2: DMG Mori CNC Machine #02
      {
        code: 'AST-CNC-2024-002',
        name: 'DMG Mori 5-Axis Milling Unit Alpha-02',
        itemType: 'asset',
        categoryId: cAsset1.id,
        modelId: mod1.id,
        supplierId: v1.id,
        uom: 'unit',
        totalQuantity: 1,
        availableQuantity: 1,
        minThreshold: 2,
        recordDate: '2026-01-15',
        status: 'available',
        customFieldsData: {
          voltage_rating: '380V 3-Phase',
          max_operating_pressure: 120,
          calibration_interval: 'Quarterly',
        },
        notes: 'Secondary milling station at Shop Floor Bay A1.',
        engagementStatus: 'idle',
        totalEngagementMinutes: 30 * 24 * 60,
      },
      // Asset 3: Bosch Rotary Hammer #01 (Model threshold = 3, total available = 2 -> Low Stock for this model!)
      {
        code: 'AST-HAM-2024-001',
        name: 'Bosch SDS-Max Rotary Hammer #01',
        itemType: 'asset',
        categoryId: cAsset3.id,
        modelId: mod2.id,
        supplierId: v1.id,
        uom: 'unit',
        totalQuantity: 1,
        availableQuantity: 1,
        minThreshold: 3,
        recordDate: '2026-02-01',
        status: 'available',
        customFieldsData: {},
        notes: 'Heavy concrete anchoring tool in Workshop Tool Crib.',
        engagementStatus: 'idle',
        totalEngagementMinutes: 150 * 60,
      },
      // Asset 4: Bosch Rotary Hammer #02
      {
        code: 'AST-HAM-2024-002',
        name: 'Bosch SDS-Max Rotary Hammer #02',
        itemType: 'asset',
        categoryId: cAsset3.id,
        modelId: mod2.id,
        supplierId: v1.id,
        uom: 'unit',
        totalQuantity: 1,
        availableQuantity: 1,
        minThreshold: 3,
        recordDate: '2026-02-05',
        status: 'available',
        customFieldsData: {},
        notes: 'Stored in Tool Crib shelf B.',
        engagementStatus: 'idle',
        totalEngagementMinutes: 90 * 60,
      },
      // Asset 5: Fluke Multimeter #01 (Model threshold = 4, total available = 2 -> Low Stock for this model!)
      {
        code: 'AST-FLK-2024-001',
        name: 'Fluke 87V Industrial Multimeter Lab Unit',
        itemType: 'asset',
        categoryId: cAsset2.id,
        modelId: mod3.id,
        supplierId: v4.id,
        uom: 'unit',
        totalQuantity: 1,
        availableQuantity: 1,
        minThreshold: 4,
        recordDate: '2026-02-12',
        status: 'available',
        customFieldsData: {
          accuracy_class: '±0.05% DC Voltage accuracy',
        },
        notes: 'Calibrated multimeter at Quality Testing Lab Bench 2.',
        engagementStatus: 'engaged',
        firstEngagedAt: new Date(Date.now() - 20 * 86400000),
        lastEngagedAt: new Date(),
        totalEngagementMinutes: 20 * 24 * 60,
      },
      // Asset 6: Fluke Multimeter #02
      {
        code: 'AST-FLK-2024-002',
        name: 'Fluke 87V Industrial Multimeter Field Unit',
        itemType: 'asset',
        categoryId: cAsset2.id,
        modelId: mod3.id,
        supplierId: v4.id,
        uom: 'unit',
        totalQuantity: 1,
        availableQuantity: 1,
        minThreshold: 4,
        recordDate: '2026-02-15',
        status: 'available',
        customFieldsData: {
          accuracy_class: '±0.05% DC Voltage accuracy',
        },
        notes: 'Field technician diagnostic kit.',
        engagementStatus: 'idle',
        totalEngagementMinutes: 45 * 60,
      },
      // Consumable 1: Mobil Vactra Slideway Oil (Model threshold = 50 L, Available: 35 L -> LOW STOCK alert!)
      {
        code: 'CON-LUB-MOB-200L',
        name: 'Mobil Vactra Slideway Oil No. 2 Drum Batch',
        itemType: 'consumable',
        categoryId: cCons1.id,
        modelId: mod4.id,
        supplierId: v1.id,
        uom: 'liter',
        totalQuantity: 200,
        availableQuantity: 35, // Trigger low stock
        minThreshold: 50,
        recordDate: '2026-03-01',
        status: 'low_stock',
        customFieldsData: {
          viscosity_grade: 'ISO VG 68',
          hazard_rating: 'Low / Non-Hazardous',
          flash_point: 228,
        },
        notes: 'Stock level (35 L) is below model minimum threshold (50 L). Automated reorder recommended.',
      },
      // Consumable 2: 3M N95 Respirators (Model threshold = 30 pkgs, Available: 18 pkgs -> LOW STOCK alert!)
      {
        code: 'CON-PPE-N95-BX',
        name: '3M Aura FFP2 / N95 Respirator Mask Boxes',
        itemType: 'consumable',
        categoryId: cCons3.id,
        modelId: mod5.id,
        supplierId: v3.id,
        uom: 'package',
        totalQuantity: 100,
        availableQuantity: 18, // Trigger low stock
        minThreshold: 30,
        recordDate: '2026-03-05',
        status: 'low_stock',
        customFieldsData: {},
        notes: 'Stock level (18 boxes) is below model minimum threshold (30 boxes). Cleanroom replenishment required.',
      },
      // Consumable 3: Loctite 243 Threadlocker (Model threshold = 15 bottles, Available: 45 bottles -> In Stock / Healthy)
      {
        code: 'CON-LOC-243-50ML',
        name: 'Loctite 243 Medium Threadlocker 50ml Bottles',
        itemType: 'consumable',
        categoryId: cCons4.id,
        modelId: mod6.id,
        supplierId: v3.id,
        uom: 'bottle',
        totalQuantity: 60,
        availableQuantity: 45,
        minThreshold: 15,
        recordDate: '2026-02-25',
        status: 'available',
        customFieldsData: {
          cure_time: 24,
        },
        notes: 'Standard assembly chemical supplies in good standing.',
      },
      // Consumable 4: SKF Ball Bearings (Model threshold = 25 units, Available: 12 units -> LOW STOCK alert!)
      {
        code: 'CON-BEAR-SKF-6205',
        name: 'SKF 6205-2RSH Deep Groove Ball Bearings',
        itemType: 'consumable',
        categoryId: cCons2.id,
        modelId: mod7.id,
        supplierId: v3.id,
        uom: 'unit',
        totalQuantity: 50,
        availableQuantity: 12, // Trigger low stock
        minThreshold: 25,
        recordDate: '2026-02-28',
        status: 'low_stock',
        customFieldsData: {},
        notes: 'Motor refurbishment spare parts below 25 unit threshold.',
      },
      // Consumable 5: Nitrile Gasket Cord (Standalone item without model, threshold = 60 m, Available: 320 m -> In Stock)
      {
        code: 'CON-SEAL-NBR-ROLL',
        name: 'Nitrile High-Grade Rubber Gasket Cord 5mm',
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
        notes: 'Continuous roll for chamber sealing.',
      },
    ]).returning();

    // 14. Stock Locations (Quantities per branch, department, location, and machine)
    await db.insert(stockLocations).values([
      { itemId: itAsset1.id, branchId: b1.id, departmentId: d1.id, locationId: loc1.id, machineId: m1.id, quantity: 1 },
      { itemId: itAsset2.id, branchId: b1.id, departmentId: d1.id, locationId: loc1.id, machineId: null, quantity: 1 },
      { itemId: itAsset3.id, branchId: b1.id, departmentId: d2.id, locationId: loc2.id, machineId: null, quantity: 1 },
      { itemId: itAsset4.id, branchId: b1.id, departmentId: d2.id, locationId: loc2.id, machineId: null, quantity: 1 },
      { itemId: itAsset5.id, branchId: b1.id, departmentId: d3.id, locationId: loc3.id, machineId: null, quantity: 1 },
      { itemId: itAsset6.id, branchId: b1.id, departmentId: d3.id, locationId: loc3.id, machineId: null, quantity: 1 },
      { itemId: itCons1.id, branchId: b1.id, departmentId: d1.id, locationId: loc1.id, machineId: m1.id, quantity: 20 },
      { itemId: itCons1.id, branchId: b1.id, departmentId: d6.id, locationId: loc5.id, machineId: null, quantity: 15 },
      { itemId: itCons2.id, branchId: b1.id, departmentId: d3.id, locationId: loc3.id, machineId: null, quantity: 18 },
      { itemId: itCons3.id, branchId: b1.id, departmentId: d1.id, locationId: loc1.id, machineId: null, quantity: 45 },
      { itemId: itCons4.id, branchId: b1.id, departmentId: d2.id, locationId: loc2.id, machineId: m3.id, quantity: 12 },
      { itemId: itCons5.id, branchId: b1.id, departmentId: d1.id, locationId: loc1.id, machineId: null, quantity: 320 },
    ]);

    // 15. Stock Movements (Branch transfers, intra-branch moves, and machine allocations)
    await db.insert(inventoryMovements).values([
      // Movement 1: Inter-branch transfer pending acceptance at West Logistics Hub
      {
        itemId: itCons3.id,
        movementType: 'branch_to_branch',
        fromBranchId: b1.id,
        toBranchId: b2.id,
        toDepartmentId: d4.id,
        toLocationId: loc4.id,
        toMachineId: null,
        quantity: 10,
        uom: 'bottle',
        status: 'pending_acceptance',
        movedByUserId: uAdmin.id,
        notes: 'Inter-branch shipment of 10 Loctite bottles for West Hub stock rebalance.',
        createdAt: new Date(Date.now() - 3600000 * 6),
      },
      // Movement 2: Intra-branch location transfer (completed)
      {
        itemId: itCons1.id,
        movementType: 'location_to_location',
        fromBranchId: b1.id,
        toBranchId: b1.id,
        toDepartmentId: d1.id,
        toLocationId: loc1.id,
        toMachineId: m1.id,
        quantity: 20,
        uom: 'liter',
        status: 'completed',
        movedByUserId: uMgr1.id,
        notes: 'Slideway oil allocated directly to CNC Milling Machine reservoir.',
        createdAt: new Date(Date.now() - 86400000 * 2),
      },
      // Movement 3: Asset Machine Allocation
      {
        itemId: itAsset1.id,
        movementType: 'assigned_to_machine',
        fromBranchId: b1.id,
        toBranchId: b1.id,
        toDepartmentId: d1.id,
        toLocationId: loc1.id,
        toMachineId: m1.id,
        quantity: 1,
        uom: 'unit',
        status: 'completed',
        movedByUserId: uSuper.id,
        notes: 'Assigned asset to primary 5-Axis CNC Milling Center.',
        createdAt: new Date(Date.now() - 86400000 * 10),
      },
    ]);

    // 16. Employee Requests
    await db.insert(employeeRequests).values([
      // Request 1: Issued consumable request
      {
        requestId: 'REQ-2026-001',
        employeeId: emp1.id,
        branchId: b1.id,
        departmentId: d1.id,
        itemId: itCons1.id,
        requestedQty: 10,
        uom: 'liter',
        reasonId: r4.id,
        reasonText: 'Weekly Batch Production Consumable Refill',
        machineId: m1.id,
        securityPinEntered: '1001',
        status: 'issued',
        requestedAt: new Date(Date.now() - 3600000 * 24),
        issuedAt: new Date(Date.now() - 3600000 * 20),
        issuedByUserId: uMgr1.id,
        managerNotes: 'Approved and issued 10 Liters of Mobil Vactra Oil to CNC Milling Center.',
      },
      // Request 2: Pending request awaiting manager approval
      {
        requestId: 'REQ-2026-002',
        employeeId: emp2.id,
        branchId: b1.id,
        departmentId: d2.id,
        itemId: itAsset3.id,
        requestedQty: 1,
        uom: 'unit',
        reasonId: r2.id,
        reasonText: 'Emergency Machine Breakdown Repair',
        machineId: m3.id,
        securityPinEntered: '1002',
        status: 'pending',
        requestedAt: new Date(Date.now() - 3600000 * 2),
        managerNotes: null,
      },
      // Request 3: Approved request ready for issuance
      {
        requestId: 'REQ-2026-003',
        employeeId: emp4.id,
        branchId: b1.id,
        departmentId: d1.id,
        itemId: itCons2.id,
        requestedQty: 5,
        uom: 'package',
        reasonId: r6.id,
        reasonText: 'Spill Containment & Urgent Safety Measure',
        machineId: null,
        securityPinEntered: '1004',
        status: 'approved',
        requestedAt: new Date(Date.now() - 3600000 * 4),
        managerNotes: 'Approved for assembly team shift PPE replenishment.',
      },
    ]);

    // 17. Vendor Repairs (Engagement tracking before repair)
    await db.insert(vendorRepairs).values([
      {
        itemId: itAsset4.id,
        vendorId: v1.id,
        branchId: b1.id,
        sentDate: '2026-02-15',
        expectedReturnDate: '2026-03-10',
        returnedDate: null,
        issueDescription: 'Gearbox clutch slipping under heavy drilling load. Precision armature overhaul required.',
        repairCost: 165.00,
        status: 'sent_to_vendor',
        engagedDurationMinutes: 180 * 24 * 60, // 180 days engaged prior to repair
        managerNotes: 'Asset was heavily utilized in tooling workshop before clutch wear.',
      },
      {
        itemId: itAsset6.id,
        vendorId: v4.id,
        branchId: b1.id,
        sentDate: '2026-01-20',
        expectedReturnDate: '2026-02-05',
        returnedDate: '2026-02-04',
        issueDescription: 'Annual ISO 17025 metrology calibration and test probe replacement.',
        repairCost: 85.00,
        status: 'returned',
        engagedDurationMinutes: 300 * 24 * 60,
        managerNotes: 'Calibration certificate verified and filed in QA portal.',
      },
    ]);

    // 18. Entry Logs / Audit Trail
    await db.insert(entryLogs).values([
      {
        userId: uAdmin.id,
        userName: 'Arthur Pendelton (Admin)',
        userRole: 'admin',
        branchId: b1.id,
        action: 'INITIALIZE_SYSTEM',
        entityType: 'system',
        entityId: 'SYS-INIT',
        details: 'Initial corporate branches, multi-tier departments, asset/consumable categories, and UOM standards configured.',
        createdAt: new Date(Date.now() - 86400000 * 5),
      },
      {
        userId: uSuper.id,
        userName: 'Claire Sterling (Super Manager)',
        userRole: 'super_manager',
        branchId: b1.id,
        action: 'CREATE_MODEL_AND_FIELDS',
        entityType: 'model',
        entityId: 'MOD-CMX-50V',
        details: 'Created DMG Mori CNC model (Threshold: 2 units) and bound Technical Specifications field set.',
        createdAt: new Date(Date.now() - 86400000 * 3),
      },
      {
        userId: uMgr1.id,
        userName: 'Robert Fox (Manager)',
        userRole: 'manager',
        branchId: b1.id,
        action: 'ISSUE_REQUEST',
        entityType: 'request',
        entityId: 'REQ-2026-001',
        details: 'Issued 10 Liters of Mobil Vactra Oil to Employee David Miller for CNC-501.',
        createdAt: new Date(Date.now() - 3600000 * 20),
      },
      {
        userId: uAdmin.id,
        userName: 'Arthur Pendelton (Admin)',
        userRole: 'admin',
        branchId: b1.id,
        action: 'STOCK_TRANSFER_INITIATED',
        entityType: 'movement',
        entityId: 'MOV-WEST-REBALANCE',
        details: 'Initiated inter-branch stock transfer of 10 Loctite 243 bottles to West Logistics Hub.',
        createdAt: new Date(Date.now() - 3600000 * 6),
      },
    ]);

    console.log('Database sample records successfully seeded!');
  } catch (error) {
    console.error('Error during database seed:', error);
  }
}
