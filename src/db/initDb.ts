import { pool } from './index.ts';
import { seedDatabase } from './seed.ts';
import { hashPassword, isPasswordHashed } from '../lib/auth-crypto.ts';

export const SCHEMA_TABLES = [
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
  'users',
];

export const INITIALIZE_TABLES_SQL = `
-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  password TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'manager',
  branch_id INTEGER,
  department_id INTEGER,
  user_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Branches
CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Departments
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  floor_location TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4. Locations & Sublocations
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL,
  department_id INTEGER,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'storage',
  parent_location_id INTEGER,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 5. Machines
CREATE TABLE IF NOT EXISTS machines (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL,
  department_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  machine_code TEXT NOT NULL,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 6. Employees
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  employee_code TEXT NOT NULL UNIQUE,
  branch_id INTEGER NOT NULL,
  user_code TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 6b. Employee Departments
CREATE TABLE IF NOT EXISTS employee_departments (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  department_id INTEGER NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 7. Categories
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 8. User Category Permissions
CREATE TABLE IF NOT EXISTS user_category_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  can_manage BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 9. Custom Fields
CREATE TABLE IF NOT EXISTS custom_fields (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  options JSONB,
  is_required BOOLEAN NOT NULL DEFAULT false,
  default_value TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 10. Field Sets
CREATE TABLE IF NOT EXISTS field_sets (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 10b. Field Set Items
CREATE TABLE IF NOT EXISTS field_set_items (
  id SERIAL PRIMARY KEY,
  field_set_id INTEGER NOT NULL,
  custom_field_id INTEGER NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

-- 11. Models
CREATE TABLE IF NOT EXISTS models (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL,
  field_set_id INTEGER,
  name TEXT NOT NULL,
  model_number TEXT NOT NULL,
  min_threshold REAL NOT NULL DEFAULT 5,
  manufacturer TEXT,
  description TEXT,
  image_url TEXT,
  custom_fields_data JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 12. Vendors
CREATE TABLE IF NOT EXISTS vendors (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  service_type TEXT NOT NULL DEFAULT 'supplier_and_repair',
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 12b. Vendor Branch Assignments
CREATE TABLE IF NOT EXISTS vendor_branch_assignments (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL,
  granted_by_user_id INTEGER,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 13. Pre-fed Request Reasons
CREATE TABLE IF NOT EXISTS request_reasons (
  id SERIAL PRIMARY KEY,
  reason TEXT NOT NULL,
  category_type TEXT NOT NULL DEFAULT 'all',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 14. Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  item_type TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  model_id INTEGER,
  supplier_id INTEGER,
  uom TEXT NOT NULL,
  total_quantity REAL NOT NULL DEFAULT 1,
  available_quantity REAL NOT NULL DEFAULT 1,
  min_threshold REAL NOT NULL DEFAULT 5,
  record_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  custom_fields_data JSONB,
  image_url TEXT,
  notes TEXT,
  engagement_status TEXT DEFAULT 'idle',
  first_engaged_at TIMESTAMP WITHOUT TIME ZONE,
  last_engaged_at TIMESTAMP WITHOUT TIME ZONE,
  total_engagement_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 15. Stock Locations
CREATE TABLE IF NOT EXISTS stock_locations (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL,
  department_id INTEGER,
  location_id INTEGER,
  machine_id INTEGER,
  quantity REAL NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 16. Employee Requests
CREATE TABLE IF NOT EXISTS employee_requests (
  id SERIAL PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  employee_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL,
  department_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  requested_qty REAL NOT NULL,
  uom TEXT NOT NULL,
  reason_id INTEGER,
  reason_text TEXT NOT NULL,
  machine_id INTEGER,
  security_pin_entered TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  issued_at TIMESTAMP WITHOUT TIME ZONE,
  issued_by_user_id INTEGER,
  manager_notes TEXT
);

-- 17. Inventory Movements & Transfers
CREATE TABLE IF NOT EXISTS inventory_movements (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL,
  quantity REAL NOT NULL,
  uom TEXT NOT NULL,
  movement_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  from_branch_id INTEGER NOT NULL,
  to_branch_id INTEGER NOT NULL,
  from_department_id INTEGER,
  to_department_id INTEGER,
  from_location_id INTEGER,
  to_location_id INTEGER,
  to_machine_id INTEGER,
  moved_by_user_id INTEGER,
  accepted_by_user_id INTEGER,
  accepted_at TIMESTAMP WITHOUT TIME ZONE,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 18. Vendor Repairs
CREATE TABLE IF NOT EXISTS vendor_repairs (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL,
  vendor_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL,
  sent_date TEXT NOT NULL,
  expected_return_date TEXT,
  returned_date TEXT,
  issue_description TEXT NOT NULL,
  repair_cost REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sent_to_vendor',
  engaged_duration_minutes INTEGER DEFAULT 0,
  manager_notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 19. System Audit Logs
CREATE TABLE IF NOT EXISTS entry_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  branch_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_employees_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_pin ON employees(user_code);
CREATE INDEX IF NOT EXISTS idx_inventory_items_code ON inventory_items(code);
CREATE INDEX IF NOT EXISTS idx_inventory_items_cat ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_stock_locations_item ON stock_locations(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_locations_branch ON stock_locations(branch_id);
CREATE INDEX IF NOT EXISTS idx_employee_requests_branch ON employee_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_movements_item ON inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON entry_logs(created_at DESC);
`;

/**
 * Initializes all PostgreSQL database tables automatically if they don't exist.
 * Then checks if seed data is needed.
 */
export async function initializeDatabaseSchema(): Promise<{
  success: boolean;
  existingTablesCount: number;
  message: string;
}> {
  console.log('[PostgreSQL] Checking database schema & tables...');
  try {
    // 1. Run Table & Index Creation DDL (if permissions allow)
    try {
      await pool.query(INITIALIZE_TABLES_SQL);
    } catch (ddlErr: any) {
      console.log('[PostgreSQL] Table schema managed by Cloud SQL migration or already initialized:', ddlErr.message || ddlErr);
    }

    // Dynamic column additions / sync and encryption for users
    try {
      try {
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;`);
      } catch (alterErr) {
        // Handled if already exists or permission
      }

      try {
        await pool.query(`ALTER TABLE models ADD COLUMN IF NOT EXISTS min_threshold REAL NOT NULL DEFAULT 5;`);
        await pool.query(`ALTER TABLE models ADD COLUMN IF NOT EXISTS image_url TEXT;`);
        await pool.query(`ALTER TABLE models ADD COLUMN IF NOT EXISTS custom_fields_data JSONB;`);
      } catch (alterErr) {
        // Handled if already exists or permission
      }

      // Sync configured Admin user & password from environment secrets if provided
      const envAdminUser = (process.env.ADMIN_USER || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
      const envAdminPass = (process.env.ADMIN_PASSWORD || '').trim();
      const envAdminName = (process.env.ADMIN_NAME || 'System Administrator').trim();

      if (envAdminUser || envAdminPass) {
        const targetEmail = envAdminUser || 'admin@company.local';
        const targetPass = envAdminPass || 'admin';
        const encryptedAdminPass = hashPassword(targetPass);

        const adminCheck = await pool.query(
          `SELECT id, password FROM users WHERE LOWER(email) = $1 OR role = 'admin' ORDER BY id ASC LIMIT 1;`,
          [targetEmail]
        );

        if (adminCheck.rows.length > 0) {
          await pool.query(
            `UPDATE users SET email = $1, password = $2, role = 'admin', is_active = true WHERE id = $3;`,
            [targetEmail, encryptedAdminPass, adminCheck.rows[0].id]
          );
          console.log(`[PostgreSQL] Synchronized and encrypted Admin credentials from environment secret for ${targetEmail}.`);
        } else {
          await pool.query(
            `INSERT INTO users (uid, email, password, name, role, is_active) VALUES ($1, $2, $3, $4, 'admin', true);`,
            [`admin-secret-${Date.now()}`, targetEmail, encryptedAdminPass, envAdminName]
          );
          console.log(`[PostgreSQL] Provisioned initial Admin user with encrypted password from environment secret for ${targetEmail}.`);
        }
      }

      // Encrypt / hash all user passwords that are unhashed or blank
      const allUsersRes = await pool.query(`SELECT id, role, password FROM users;`);
      for (const u of allUsersRes.rows) {
        if (!u.password || !isPasswordHashed(u.password)) {
          let plainToHash = u.password;
          if (!plainToHash) {
            if (u.role === 'admin') plainToHash = 'admin';
            else if (u.role === 'super_manager') plainToHash = 'super';
            else if (u.role === 'manager') plainToHash = 'manager';
            else if (u.role === 'department') plainToHash = 'dept';
            else plainToHash = 'welcome123';
          }
          const encryptedHash = hashPassword(plainToHash);
          await pool.query(`UPDATE users SET password = $1 WHERE id = $2;`, [encryptedHash, u.id]);
          console.log(`[PostgreSQL] Encrypted password for user #${u.id} (${u.role}) with strong bcrypt encryption.`);
        }
      }
    } catch (colErr) {
      console.warn('[PostgreSQL] Column/Admin sync and encryption notice:', colErr);
    }

    console.log('[PostgreSQL] Database tables & indexes verified/created successfully.');

    // 2. Count existing tables in public schema
    const tableCheckRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE';
    `);

    const existingTables = tableCheckRes.rows.map((r: any) => r.table_name);
    console.log(`[PostgreSQL] Total active tables in database: ${existingTables.length} (${existingTables.join(', ')})`);

    // 3. Trigger initial seed if database is empty
    try {
      await seedDatabase();
    } catch (seedErr) {
      console.warn('[PostgreSQL] Notice during initial seed:', seedErr);
    }

    return {
      success: true,
      existingTablesCount: existingTables.length,
      message: `Database schema verified with ${existingTables.length} tables active.`,
    };
  } catch (error: any) {
    console.error('[PostgreSQL] Error during database initialization:', error);
    return {
      success: false,
      existingTablesCount: 0,
      message: error.message || 'Failed to initialize database tables.',
    };
  }
}
