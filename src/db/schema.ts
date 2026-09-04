import { boolean, integer, jsonb, pgTable, real, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Users & Authentication
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // System user UID
  email: text('email').notNull(),
  password: text('password'), // User login password
  name: text('name').notNull(),
  role: text('role').notNull().default('manager'), // 'admin' | 'super_manager' | 'manager' | 'department'
  branchId: integer('branch_id'),
  departmentId: integer('department_id'),
  userCode: text('user_code'), // 4-digit numeric code for employee punch / kiosk
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Branches
export const branches = pgTable('branches', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  location: text('location').notNull(),
  phone: text('phone'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Departments
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').notNull(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  floorLocation: text('floor_location'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Locations & Sublocations (Within branches/departments)
export const locations = pgTable('locations', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').notNull(),
  departmentId: integer('department_id'),
  name: text('name').notNull(),
  type: text('type').notNull().default('storage'), // 'storage' | 'room' | 'rack' | 'bay' | 'shelf' | 'department'
  parentLocationId: integer('parent_location_id'), // for sublocations
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Machines (Which also act as request destination locations in departments)
export const machines = pgTable('machines', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').notNull(),
  departmentId: integer('department_id').notNull(),
  name: text('name').notNull(),
  machineCode: text('machine_code').notNull(),
  model: text('model'),
  status: text('status').notNull().default('active'), // 'active' | 'maintenance' | 'offline'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Employees (linked to branches and multiple departments)
export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  employeeCode: text('employee_code').notNull().unique(),
  branchId: integer('branch_id').notNull(),
  userCode: text('user_code').notNull(), // 4-digit security PIN
  phone: text('phone'),
  email: text('email'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Employee Department Association (One employee to many departments)
export const employeeDepartments = pgTable('employee_departments', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull(),
  departmentId: integer('department_id').notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. Categories (Asset & Consumable categories created by Admin)
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  type: text('type').notNull(), // 'asset' | 'consumable'
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. User Category Permissions (Admin assigns categories to Super Managers and Managers)
export const userCategoryPermissions = pgTable('user_category_permissions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  categoryId: integer('category_id').notNull(),
  canManage: boolean('can_manage').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. Custom Fields (Created under categories: textbox string, dropdown, radio, numeric, date)
export const customFields = pgTable('custom_fields', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').notNull(),
  name: text('name').notNull(),
  label: text('label').notNull(),
  fieldType: text('field_type').notNull(), // 'text' | 'number' | 'dropdown' | 'radio' | 'date' | 'boolean'
  options: jsonb('options'), // array of strings for dropdown / radio options
  isRequired: boolean('is_required').notNull().default(false),
  defaultValue: text('default_value'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. Field Sets (Groups of custom fields)
export const fieldSets = pgTable('field_sets', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Field Set Items mapping
export const fieldSetItems = pgTable('field_set_items', {
  id: serial('id').primaryKey(),
  fieldSetId: integer('field_set_id').notNull(),
  customFieldId: integer('custom_field_id').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
});

// 11. Models (Created by Super Manager under allotted categories, linked with a Field Set)
export const models = pgTable('models', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').notNull(),
  fieldSetId: integer('field_set_id'),
  name: text('name').notNull(),
  modelNumber: text('model_number').notNull(),
  minThreshold: real('min_threshold').notNull().default(5), // Low stock alert threshold for model
  manufacturer: text('manufacturer'),
  description: text('description'),
  imageUrl: text('image_url'),
  customFieldsData: jsonb('custom_fields_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Vendors / Suppliers (For procurement & repairs)
export const vendors = pgTable('vendors', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id'), // originating branch where vendor was created (or null for HQ/global)
  name: text('name').notNull(),
  contactPerson: text('contact_person'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  serviceType: text('service_type').notNull().default('supplier_and_repair'), // 'supplier' | 'repair' | 'supplier_and_repair'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12b. Vendor Branch Visibility Assignments (Admin allows other branches to access/view specific vendors)
export const vendorBranchAssignments = pgTable('vendor_branch_assignments', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull(),
  branchId: integer('branch_id').notNull(),
  grantedByUserId: integer('granted_by_user_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 13. Pre-fed Request Reasons (Configured by Admin)
export const requestReasons = pgTable('request_reasons', {
  id: serial('id').primaryKey(),
  reason: text('reason').notNull(),
  categoryType: text('category_type').notNull().default('all'), // 'asset' | 'consumable' | 'all'
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 14. Inventory Items (Assets and Consumables)
// UOM allowed: 'unit' | 'roll' | 'package' | 'liter' | 'gram' | 'kilogram' | 'meter' | 'millimeter'
export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // Asset tag or SKU code
  name: text('name').notNull(),
  itemType: text('item_type').notNull(), // 'asset' | 'consumable'
  categoryId: integer('category_id').notNull(),
  modelId: integer('model_id'),
  supplierId: integer('supplier_id'),
  uom: text('uom').notNull(), // 'unit' | 'roll' | 'package' | 'liter' | 'gram' | 'kilogram' | 'meter' | 'millimeter'
  totalQuantity: real('total_quantity').notNull().default(1),
  availableQuantity: real('available_quantity').notNull().default(1),
  minThreshold: real('min_threshold').notNull().default(5), // Low stock alert threshold
  recordDate: text('record_date').notNull(), // YYYY-MM-DD
  status: text('status').notNull().default('available'), // 'available' | 'in_use' | 'low_stock' | 'in_repair' | 'trashed' | 'transferred'
  customFieldsData: jsonb('custom_fields_data'), // Key-value object of custom fields
  imageUrl: text('image_url'), // Picture / photo of asset or consumable
  notes: text('notes'),
  
  // Engagement & Lifetime tracking for Assets
  engagementStatus: text('engagement_status').default('idle'), // 'idle' | 'engaged' | 'repaired' | 'trashed'
  firstEngagedAt: timestamp('first_engaged_at'),
  lastEngagedAt: timestamp('last_engaged_at'),
  totalEngagementMinutes: integer('total_engagement_minutes').default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 15. Stock Locations (Quantities per branch, department, sublocation)
export const stockLocations = pgTable('stock_locations', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id').notNull(),
  branchId: integer('branch_id').notNull(),
  departmentId: integer('department_id'),
  locationId: integer('location_id'),
  machineId: integer('machine_id'),
  quantity: real('quantity').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 16. Employee Requests & Issuance
export const employeeRequests = pgTable('employee_requests', {
  id: serial('id').primaryKey(),
  requestId: text('request_id').notNull().unique(),
  employeeId: integer('employee_id').notNull(),
  branchId: integer('branch_id').notNull(),
  departmentId: integer('department_id').notNull(),
  itemId: integer('item_id').notNull(),
  requestedQty: real('requested_qty').notNull(),
  uom: text('uom').notNull(),
  reasonId: integer('reason_id'),
  reasonText: text('reason_text').notNull(),
  machineId: integer('machine_id'),
  securityPinEntered: text('security_pin_entered').notNull(), // 4 digit code verified
  status: text('status').notNull().default('pending'), // 'pending' | 'issued' | 'rejected' | 'returned'
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  issuedAt: timestamp('issued_at'),
  issuedByUserId: integer('issued_by_user_id'),
  managerNotes: text('manager_notes'),
});

// 17. Transfers & Movements (Between departments or branches)
export const inventoryMovements = pgTable('inventory_movements', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id').notNull(),
  quantity: real('quantity').notNull(),
  uom: text('uom').notNull(),
  movementType: text('movement_type').notNull(), // 'dept_to_dept' | 'branch_to_branch' | 'assigned_to_machine' | 'issued_to_employee' | 'sent_to_vendor' | 'returned_from_vendor' | 'trashed'
  status: text('status').notNull().default('completed'), // 'pending_acceptance' | 'accepted' | 'rejected' | 'completed'
  fromBranchId: integer('from_branch_id').notNull(),
  toBranchId: integer('to_branch_id').notNull(),
  fromDepartmentId: integer('from_department_id'),
  toDepartmentId: integer('to_department_id'),
  fromLocationId: integer('from_location_id'),
  toLocationId: integer('to_location_id'),
  toMachineId: integer('to_machine_id'),
  movedByUserId: integer('moved_by_user_id'),
  acceptedByUserId: integer('accepted_by_user_id'),
  acceptedAt: timestamp('accepted_at'),
  rejectionReason: text('rejection_reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 18. Vendor Repairs & Maintenance (Engagement calculation before trash/repair)
export const vendorRepairs = pgTable('vendor_repairs', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id').notNull(),
  vendorId: integer('vendor_id').notNull(),
  branchId: integer('branch_id').notNull(),
  sentDate: text('sent_date').notNull(), // YYYY-MM-DD
  expectedReturnDate: text('expected_return_date'),
  returnedDate: text('returned_date'),
  issueDescription: text('issue_description').notNull(),
  repairCost: real('repair_cost').default(0),
  status: text('status').notNull().default('sent_to_vendor'), // 'sent_to_vendor' | 'repaired' | 'unrepairable_trashed' | 'returned'
  engagedDurationMinutes: integer('engaged_duration_minutes').default(0), // How long the asset was engaged before repair
  managerNotes: text('manager_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 19. System Entry Logs / Audit Trail
export const entryLogs = pgTable('entry_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  userName: text('user_name').notNull(),
  userRole: text('user_role').notNull(),
  branchId: integer('branch_id'),
  action: text('action').notNull(), // e.g. 'CREATE_ASSET', 'MOVE_STOCK', 'ISSUE_REQUEST', 'VENDOR_REPAIR', etc.
  entityType: text('entity_type').notNull(), // 'inventory', 'request', 'category', 'model', 'movement', 'vendor'
  entityId: text('entity_id'),
  details: text('details').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 20. Preventive Maintenance Plans (Master Templates)
export const pmPlans = pgTable('pm_plans', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // e.g. 'PM-CNC-MONTHLY'
  title: text('title').notNull(),
  description: text('description'),
  category: text('category').notNull().default('General Maintenance'), // 'Mechanical' | 'Electrical' | 'Hydraulic' | 'Lubrication' | 'Safety & Calibration'
  frequencyType: text('frequency_type').notNull().default('monthly'), // 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semi_annually' | 'annually' | 'custom_days'
  frequencyInterval: integer('frequency_interval').notNull().default(1),
  estimatedDurationMinutes: integer('estimated_duration_minutes').notNull().default(60),
  priority: text('priority').notNull().default('medium'), // 'critical' | 'high' | 'medium' | 'low'
  machineCategory: text('machine_category'), // Optional machine type or 'All'
  checklistTemplate: jsonb('checklist_template'), // Array of PM tasks
  requiredPartsTemplate: jsonb('required_parts_template'), // Array of required spare parts / fluids
  safetyNotes: text('safety_notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdById: integer('created_by_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 21. Preventive Maintenance Schedules (Machine recurring schedule assignments)
export const pmSchedules = pgTable('pm_schedules', {
  id: serial('id').primaryKey(),
  planId: integer('plan_id').notNull(),
  machineId: integer('machine_id').notNull(),
  branchId: integer('branch_id').notNull(),
  departmentId: integer('department_id').notNull(),
  assignedEmployeeId: integer('assigned_employee_id'),
  scheduleType: text('schedule_type').notNull().default('fixed_calendar'), // 'fixed_calendar' | 'rolling_after_completion'
  frequencyType: text('frequency_type').notNull().default('monthly'),
  frequencyInterval: integer('frequency_interval').notNull().default(1),
  startDate: text('start_date').notNull(), // YYYY-MM-DD
  nextDueDate: text('next_due_date').notNull(), // YYYY-MM-DD
  lastCompletedDate: text('last_completed_date'), // YYYY-MM-DD
  status: text('status').notNull().default('active'), // 'active' | 'paused' | 'archived'
  autoGenerateDaysInAdvance: integer('auto_generate_days_in_advance').notNull().default(7),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 22. Preventive Maintenance Work Orders / Executions (Active & completed checklists)
export const pmWorkOrders = pgTable('pm_work_orders', {
  id: serial('id').primaryKey(),
  workOrderNumber: text('work_order_number').notNull().unique(), // e.g. 'WO-PM-2026-0001'
  scheduleId: integer('schedule_id'),
  planId: integer('plan_id').notNull(),
  machineId: integer('machine_id').notNull(),
  branchId: integer('branch_id').notNull(),
  departmentId: integer('department_id').notNull(),
  title: text('title').notNull(),
  dueDate: text('due_date').notNull(), // YYYY-MM-DD
  priority: text('priority').notNull().default('medium'), // 'critical' | 'high' | 'medium' | 'low'
  status: text('status').notNull().default('scheduled'), // 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'failed'
  assignedEmployeeId: integer('assigned_employee_id'),
  assignedUserId: integer('assigned_user_id'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  completedByEmployeeId: integer('completed_by_employee_id'),
  completedByUserId: integer('completed_by_user_id'),
  completedByPin: text('completed_by_pin'),
  completedByName: text('completed_by_name'),
  checklistResults: jsonb('checklist_results'), // Array of PM task evaluation results
  partsConsumed: jsonb('parts_consumed'), // Array of parts consumed and deducted from inventory
  overallCondition: text('overall_condition').default('good'), // 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  summaryNotes: text('summary_notes'),
  timeSpentMinutes: integer('time_spent_minutes').default(0),
  skippedReason: text('skipped_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
