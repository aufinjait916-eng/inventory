export type UserRole = 'admin' | 'super_manager' | 'manager' | 'department';

export type UOMType = 'unit' | 'roll' | 'package' | 'liter' | 'gram' | 'kilogram' | 'meter' | 'millimeter';

export const UOM_OPTIONS: { value: UOMType; label: string; unitSymbol: string }[] = [
  { value: 'unit', label: 'Unit (pcs/nos)', unitSymbol: 'pcs' },
  { value: 'roll', label: 'Roll', unitSymbol: 'roll' },
  { value: 'package', label: 'Package / Box', unitSymbol: 'pkg' },
  { value: 'liter', label: 'Liter', unitSymbol: 'L' },
  { value: 'gram', label: 'Gram', unitSymbol: 'g' },
  { value: 'kilogram', label: 'Kilogram', unitSymbol: 'kg' },
  { value: 'meter', label: 'Meter', unitSymbol: 'm' },
  { value: 'millimeter', label: 'Millimeter', unitSymbol: 'mm' },
];

export interface Branch {
  id: number;
  name: string;
  code: string;
  location: string;
  phone?: string;
  createdAt: string;
}

export interface Department {
  id: number;
  branchId: number;
  name: string;
  code: string;
  floorLocation?: string;
  createdAt: string;
}

export interface LocationItem {
  id: number;
  branchId: number;
  departmentId?: number;
  name: string;
  type: string;
  parentLocationId?: number | null;
  parentLocation?: LocationItem | null;
  sublocations?: LocationItem[];
  createdAt: string;
}

export interface SystemUser {
  id: number;
  uid: string;
  email: string;
  password?: string;
  hasPassword?: boolean;
  name: string;
  role: UserRole;
  branchId?: number | null;
  departmentId?: number | null;
  userCode?: string | null;
  isActive: boolean;
  branch?: Branch | null;
  department?: Department | null;
  assignedCategoryIds?: number[];
  assignedCategories?: Category[];
  createdAt: string;
}

export interface Machine {
  id: number;
  branchId: number;
  departmentId: number;
  name: string;
  machineCode: string;
  model?: string;
  status: 'active' | 'maintenance' | 'offline';
  createdAt: string;
}

export interface Employee {
  id: number;
  name: string;
  employeeCode: string;
  branchId: number;
  userCode: string; // 4-digit PIN
  phone?: string;
  email?: string;
  isActive: boolean;
  departments?: {
    id: number;
    departmentId: number;
    isPrimary: boolean;
    department?: Department;
  }[];
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  code: string;
  type: 'asset' | 'consumable';
  description?: string;
  createdAt: string;
}

export interface CategoryPermission {
  id: number;
  userId: number;
  categoryId: number;
  canManage: boolean;
}

export interface CustomField {
  id: number;
  categoryId: number;
  name: string;
  label: string;
  fieldType: 'text' | 'number' | 'dropdown' | 'radio' | 'date' | 'boolean';
  options?: string[] | null;
  isRequired: boolean;
  defaultValue?: string | null;
  createdAt: string;
}

export interface FieldSet {
  id: number;
  categoryId: number;
  name: string;
  description?: string;
  fields?: CustomField[];
  createdAt: string;
}

export interface Model {
  id: number;
  categoryId: number;
  fieldSetId?: number | null;
  name: string;
  modelNumber: string;
  minThreshold: number;
  manufacturer?: string;
  description?: string;
  imageUrl?: string | null;
  customFieldsData?: Record<string, any> | null;
  fieldSet?: FieldSet | null;
  category?: Category | null;
  totalStockQuantity?: number;
  availableStockQuantity?: number;
  isLowStock?: boolean;
  createdAt: string;
}

export interface Vendor {
  id: number;
  branchId?: number | null;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  serviceType: 'supplier' | 'repair' | 'supplier_and_repair';
  originBranch?: Branch | null;
  assignedBranchIds?: number[];
  assignedBranches?: Branch[];
  createdAt: string;
}

export interface VendorBranchAssignment {
  id: number;
  vendorId: number;
  branchId: number;
  grantedByUserId?: number | null;
  createdAt: string;
  branch?: Branch;
  vendor?: Vendor;
}

export interface RequestReason {
  id: number;
  reason: string;
  categoryType: 'asset' | 'consumable' | 'all';
  isActive: boolean;
}

export interface StockLocation {
  id: number;
  itemId: number;
  branchId: number;
  departmentId?: number | null;
  locationId?: number | null;
  machineId?: number | null;
  quantity: number;
  updatedAt?: string;
  branch?: Branch | null;
  department?: Department | null;
  location?: (LocationItem & { formattedName?: string | null }) | null;
  machine?: Machine | null;
}

export interface InventoryItem {
  id: number;
  code: string;
  name: string;
  itemType: 'asset' | 'consumable';
  categoryId: number;
  modelId?: number | null;
  supplierId?: number | null;
  uom: UOMType;
  totalQuantity: number;
  availableQuantity: number;
  branchQuantity?: number;
  minThreshold: number;
  recordDate: string;
  status: 'available' | 'in_use' | 'low_stock' | 'in_repair' | 'trashed' | 'transferred';
  customFieldsData?: Record<string, any>;
  imageUrl?: string | null;
  notes?: string;
  
  engagementStatus?: 'idle' | 'engaged' | 'repaired' | 'trashed';
  firstEngagedAt?: string;
  lastEngagedAt?: string;
  totalEngagementMinutes?: number;

  category?: Category;
  model?: Model;
  supplier?: Vendor;
  isLowStock?: boolean;
  stockLocations?: StockLocation[];
  createdAt: string;
}

export interface Movement {
  id: number;
  itemId: number;
  quantity: number;
  uom: string;
  movementType: 'dept_to_dept' | 'branch_to_branch' | 'assigned_to_machine' | 'issued_to_employee' | 'sent_to_vendor' | 'returned_from_vendor' | 'trashed';
  status: 'pending_acceptance' | 'accepted' | 'rejected' | 'completed';
  fromBranchId: number;
  toBranchId: number;
  fromDepartmentId?: number | null;
  toDepartmentId?: number | null;
  fromLocationId?: number | null;
  toLocationId?: number | null;
  toMachineId?: number | null;
  movedByUserId?: number | null;
  acceptedByUserId?: number | null;
  acceptedAt?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  item?: InventoryItem;
  fromBranch?: Branch;
  toBranch?: Branch;
  fromDepartment?: Department;
  toDepartment?: Department;
  createdAt: string;
}

export interface EmployeeRequest {
  id: number;
  requestId: string;
  employeeId: number;
  branchId: number;
  departmentId: number;
  itemId: number;
  requestedQty: number;
  uom: string;
  reasonId?: number;
  reasonText: string;
  machineId?: number;
  status: 'pending' | 'issued' | 'rejected' | 'returned';
  requestedAt: string;
  issuedAt?: string;
  managerNotes?: string;
  employee?: Employee;
  item?: InventoryItem;
  department?: Department;
  machine?: Machine;
}

export interface VendorRepair {
  id: number;
  itemId: number;
  vendorId: number;
  branchId: number;
  sentDate: string;
  expectedReturnDate?: string;
  returnedDate?: string;
  issueDescription: string;
  repairCost: number;
  status: 'sent_to_vendor' | 'repaired' | 'unrepairable_trashed' | 'returned';
  engagedDurationMinutes: number;
  managerNotes?: string;
  item?: InventoryItem;
  vendor?: Vendor;
  branch?: Branch;
  createdAt: string;
}

export interface EntryLog {
  id: number;
  userId?: number;
  userName: string;
  userRole: string;
  branchId?: number;
  action: string;
  entityType: string;
  entityId?: string;
  details: string;
  createdAt: string;
}

export interface DashboardStats {
  totalAssets: number;
  totalConsumables: number;
  lowStockCount: number;
  lowStockItems: InventoryItem[];
  engagedAssetsCount: number;
  activeRepairsCount: number;
  pendingRequestsCount: number;
  pendingTransfersCount: number;
  recentMovementsCount: number;
  pmDueCount?: number;
  pmOverdueCount?: number;
  pmComplianceRate?: number;
}

export interface DbTableStat {
  tableName: string;
  rowCount: number;
  description: string;
  group?: 'inventory' | 'operations' | 'catalog' | 'vendors' | 'organization' | 'security';
  impactNote?: string;
}

export interface PostgresConfigInfo {
  connected: boolean;
  serverVersion: string;
  databaseName: string;
  host: string;
  port: number;
  user: string;
  ssl: boolean;
  poolMax: number;
  databaseSize: string;
  activeConnections: number;
  serverStartTime?: string;
  uptime?: string;
  tableStats: DbTableStat[];
  environment: {
    nodeEnv: string;
    hasDatabaseUrl: boolean;
    hasSqlHost: boolean;
    hasSqlUser: boolean;
    hasSqlPassword: boolean;
    hasSqlDbName: boolean;
  };
}

export interface DbConnectionTestResult {
  success: boolean;
  latencyMs: number;
  serverVersion?: string;
  databaseName?: string;
  currentUser?: string;
  error?: string;
}

// ==========================================
// PREVENTIVE MAINTENANCE TYPES
// ==========================================

export type PMFrequencyType =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semi_annually'
  | 'annually'
  | 'custom_days';

export type PMPriority = 'critical' | 'high' | 'medium' | 'low';

export type PMTaskType = 'pass_fail' | 'numeric' | 'text' | 'choice';

export interface PMChecklistTaskItem {
  id: string;
  order: number;
  task: string;
  instruction?: string;
  type: PMTaskType;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  options?: string[];
  isRequired: boolean;
}

export interface PMRequiredPart {
  itemId?: number;
  itemCode?: string;
  itemName: string;
  quantity: number;
  uom: string;
}

export interface PMPlan {
  id: number;
  code: string;
  title: string;
  description?: string;
  category: string;
  frequencyType: PMFrequencyType;
  frequencyInterval: number;
  estimatedDurationMinutes: number;
  priority: PMPriority;
  machineCategory?: string;
  checklistTemplate: PMChecklistTaskItem[];
  requiredPartsTemplate?: PMRequiredPart[];
  safetyNotes?: string;
  isActive: boolean;
  createdById?: number;
  createdAt: string;
  updatedAt: string;
  schedulesCount?: number;
}

export interface PMSchedule {
  id: number;
  planId: number;
  machineId: number;
  branchId: number;
  departmentId: number;
  assignedEmployeeId?: number | null;
  scheduleType: 'fixed_calendar' | 'rolling_after_completion';
  frequencyType: PMFrequencyType;
  frequencyInterval: number;
  startDate: string;
  nextDueDate: string;
  lastCompletedDate?: string | null;
  status: 'active' | 'paused' | 'archived';
  autoGenerateDaysInAdvance: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Hydrated joins
  plan?: PMPlan;
  machine?: Machine;
  branch?: Branch;
  department?: Department;
  assignedEmployee?: Employee | null;
  activeWorkOrder?: PMWorkOrder | null;
  daysUntilDue?: number;
  isOverdue?: boolean;
}

export type PMWorkOrderStatus = 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'failed';

export interface PMChecklistResult {
  taskId: string;
  task: string;
  type: PMTaskType;
  status: 'pass' | 'fail' | 'na';
  valueNum?: number;
  valueText?: string;
  notes?: string;
  isOutOfRange?: boolean;
}
export type PMChecklistResultItem = PMChecklistResult;

export interface PMPartConsumed {
  itemId?: number;
  itemCode?: string;
  itemName: string;
  quantity: number;
  uom: string;
  deductedFromStock?: boolean;
}
export type PMConsumedPart = PMPartConsumed;

export interface PMWorkOrder {
  id: number;
  workOrderNumber: string;
  scheduleId?: number | null;
  planId: number;
  machineId: number;
  branchId: number;
  departmentId: number;
  title: string;
  dueDate: string;
  priority: PMPriority;
  status: PMWorkOrderStatus;
  assignedEmployeeId?: number | null;
  assignedUserId?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  completedByEmployeeId?: number | null;
  completedByUserId?: number | null;
  completedByPin?: string | null;
  completedByName?: string | null;
  checklistResults?: PMChecklistResult[];
  partsConsumed?: PMPartConsumed[];
  overallCondition?: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  summaryNotes?: string;
  timeSpentMinutes?: number;
  skippedReason?: string;
  createdAt: string;
  updatedAt: string;
  // Hydrated joins
  plan?: PMPlan;
  machine?: Machine;
  branch?: Branch;
  department?: Department;
  assignedEmployee?: Employee | null;
  daysUntilDue?: number;
  isOverdue?: boolean;
}

export interface PMComplianceMetrics {
  totalSchedules: number;
  activeSchedules: number;
  totalWorkOrders: number;
  completedCount: number;
  scheduledCount: number;
  inProgressCount: number;
  overdueCount: number;
  skippedCount: number;
  complianceRatePercentage: number;
  onTimeCompletionRatePercentage: number;
  avgCompletionDurationMinutes: number;
  conditionBreakdown: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
    critical: number;
  };
  categoryBreakdown: {
    category: string;
    total: number;
    completed: number;
  }[];
  recentWorkOrders: PMWorkOrder[];
}

export interface PMBadgeCounts {
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  inProgress: number;
  totalPending: number;
}

// ==========================================
// DATABASE BACKUP & RESTORE TYPES (ADMIN)
// ==========================================

export interface DatabaseBackupMetadata {
  id: string;
  version: string;
  format?: 'sql' | 'json';
  createdAt: string;
  exportedBy: {
    id?: number;
    name: string;
    email: string;
    role: string;
  };
  databaseName: string;
  serverVersion?: string;
  totalTables: number;
  totalRecords: number;
  tableCounts: Record<string, number>;
  description?: string;
}

export interface DatabaseBackupPayload {
  metadata: DatabaseBackupMetadata;
  tables: Record<string, any[]>;
  sqlDump?: string;
}

export interface ServerBackupSnapshotFile {
  filename: string;
  id: string;
  format: 'sql' | 'json';
  createdAt: string;
  sizeBytes: number;
  sizeFormatted: string;
  totalRecords: number;
  totalTables: number;
  creatorName: string;
  creatorEmail: string;
  description?: string;
}

export interface DatabaseRestoreValidationResult {
  valid: boolean;
  error?: string;
  fileFormat?: 'sql' | 'json';
  metadata?: DatabaseBackupMetadata;
  currentTableCounts: Record<string, number>;
  backupTableCounts: Record<string, number>;
  tableDiscrepancies: {
    tableName: string;
    description: string;
    currentRows: number;
    backupRows: number;
  }[];
  totalRecordsToRestore: number;
  missingTables: string[];
}

export interface DatabaseRestoreResult {
  success: boolean;
  message: string;
  restoredAt: string;
  tablesRestored: string[];
  totalRecordsRestored: number;
  recordsPerTable: Record<string, number>;
  durationMs: number;
}
