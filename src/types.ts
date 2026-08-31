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
  manufacturer?: string;
  description?: string;
  fieldSet?: FieldSet | null;
  category?: Category | null;
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
  updatedAt: string;
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
}

export interface DbTableStat {
  tableName: string;
  rowCount: number;
  description: string;
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
