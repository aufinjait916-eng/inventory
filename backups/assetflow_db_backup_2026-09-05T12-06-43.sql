-- ==========================================================
-- AssetFlow PostgreSQL Database Dump
-- Database: cloud_sql_development_database
-- Generated: 2026-09-05T12:06:43.569Z
-- Exporter: ADMIN User (admin@company.local)
-- Total Tables: 25
-- Total Records: 152
-- Format: Standard PostgreSQL SQL Dump (psql / DDL compatible)
-- ==========================================================
-- METADATA: {"id":"backup_1788610003570","version":"1.0","format":"sql","createdAt":"2026-09-05T12:06:43.569Z","exportedBy":{"id":1,"name":"ADMIN User","email":"admin@company.local","role":"admin"},"databaseName":"cloud_sql_development_database","totalTables":25,"totalRecords":152,"tableCounts":{"branches":4,"departments":6,"locations":6,"machines":6,"employees":6,"employee_departments":7,"categories":7,"user_category_permissions":17,"custom_fields":8,"field_sets":3,"field_set_items":7,"models":7,"vendors":4,"vendor_branch_assignments":4,"request_reasons":6,"inventory_items":11,"stock_locations":13,"employee_requests":3,"inventory_movements":4,"vendor_repairs":2,"entry_logs":15,"pm_plans":0,"pm_schedules":0,"pm_work_orders":0,"users":6},"description":"Manual local database backup"}
-- ==========================================================

SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

BEGIN;

-- Step 1: Clear existing tables in reverse dependency order
DELETE FROM "users";
DELETE FROM "pm_work_orders";
DELETE FROM "pm_schedules";
DELETE FROM "pm_plans";
DELETE FROM "entry_logs";
DELETE FROM "vendor_repairs";
DELETE FROM "inventory_movements";
DELETE FROM "employee_requests";
DELETE FROM "stock_locations";
DELETE FROM "inventory_items";
DELETE FROM "request_reasons";
DELETE FROM "vendor_branch_assignments";
DELETE FROM "vendors";
DELETE FROM "models";
DELETE FROM "field_set_items";
DELETE FROM "field_sets";
DELETE FROM "custom_fields";
DELETE FROM "user_category_permissions";
DELETE FROM "categories";
DELETE FROM "employee_departments";
DELETE FROM "employees";
DELETE FROM "machines";
DELETE FROM "locations";
DELETE FROM "departments";
DELETE FROM "branches";

-- Step 2: Insert table data in relational dependency order
-- Table: "branches" (4 records)
INSERT INTO "branches" ("id", "name", "code", "location", "phone", "created_at") VALUES
  (12, 'Central Plant & HQ', 'BR-HQ01', 'Building A, Metro Industrial Zone 4', '+1 555-0100', '2026-09-01T12:42:03.261Z'::timestamptz),
  (13, 'West Logistics Hub', 'BR-WEST02', 'West Port Logistics Center, Bay 12', '+1 555-0200', '2026-09-01T12:42:03.261Z'::timestamptz),
  (14, 'North Assembly Unit', 'BR-NORTH03', 'Northern Industrial Estate, Sector 7', '+1 555-0300', '2026-09-01T12:42:03.261Z'::timestamptz),
  (15, 'East Processing Terminal', 'BR-EAST04', 'Eastern Freight & Tech Hub, Bldg 3', '+1 555-0400', '2026-09-01T12:42:03.261Z'::timestamptz);
SELECT CASE WHEN pg_get_serial_sequence('branches', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('branches', 'id'), COALESCE((SELECT MAX(id) FROM "branches"), 0) + 1, false) ELSE NULL END;

-- Table: "departments" (6 records)
INSERT INTO "departments" ("id", "branch_id", "name", "code", "floor_location", "created_at") VALUES
  (18, 12, 'Precision Assembly & Production', 'DEP-PROD', 'Floor 1, Shopfloor A', '2026-09-01T12:42:03.282Z'::timestamptz),
  (19, 12, 'Mechanical & Electrical Maintenance', 'DEP-MAINT', 'Floor 1, Workshop East', '2026-09-01T12:42:03.282Z'::timestamptz),
  (20, 12, 'Quality Assurance & Testing Lab', 'DEP-QA', 'Floor 2, Cleanroom Lab', '2026-09-01T12:42:03.282Z'::timestamptz),
  (21, 13, 'Warehouse & Shipping Logistics', 'DEP-SHIP', 'Dock Bays 1-8', '2026-09-01T12:42:03.282Z'::timestamptz),
  (22, 14, 'Fabrication & Tooling Workshop', 'DEP-FAB', 'Ground Floor Tooling Bay', '2026-09-01T12:42:03.282Z'::timestamptz),
  (23, 12, 'Chemical Processing & Fluids Bay', 'DEP-CHEM', 'Hazardous Materials Containment Bay', '2026-09-01T12:42:03.282Z'::timestamptz);
SELECT CASE WHEN pg_get_serial_sequence('departments', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('departments', 'id'), COALESCE((SELECT MAX(id) FROM "departments"), 0) + 1, false) ELSE NULL END;

-- Table: "locations" (6 records)
INSERT INTO "locations" ("id", "branch_id", "department_id", "name", "type", "parent_location_id", "created_at") VALUES
  (18, 12, 18, 'Shop Floor Bay A1', 'room', NULL, '2026-09-01T12:42:03.302Z'::timestamptz),
  (19, 12, 19, 'Tool Crib & Spare Parts Rack', 'storage', NULL, '2026-09-01T12:42:03.302Z'::timestamptz),
  (20, 12, 20, 'Calibration Bench 2', 'shelf', NULL, '2026-09-01T12:42:03.302Z'::timestamptz),
  (21, 13, 21, 'Aisle 04 Bulk Pallet Rack', 'rack', NULL, '2026-09-01T12:42:03.302Z'::timestamptz),
  (22, 12, 23, 'Flammable Storage Cabinet B3', 'storage', NULL, '2026-09-01T12:42:03.302Z'::timestamptz),
  (23, 14, 22, 'Heavy Tooling Rack T1', 'rack', NULL, '2026-09-01T12:42:03.302Z'::timestamptz);
SELECT CASE WHEN pg_get_serial_sequence('locations', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('locations', 'id'), COALESCE((SELECT MAX(id) FROM "locations"), 0) + 1, false) ELSE NULL END;

-- Table: "machines" (6 records)
INSERT INTO "machines" ("id", "branch_id", "department_id", "name", "machine_code", "model", "status", "created_at") VALUES
  (17, 12, 18, '5-Axis CNC Milling Center', 'MCH-CNC-501', 'DMG Mori CMX-50V', 'active', '2026-09-01T12:42:03.321Z'::timestamptz),
  (18, 12, 18, 'High-Speed Automated Packaging Line 2', 'MCH-PKG-002', 'Tetra Matrix 400', 'active', '2026-09-01T12:42:03.321Z'::timestamptz),
  (19, 12, 19, 'Industrial Hydraulic Press 50 Ton', 'MCH-PRS-050', 'Enerpac H-50', 'active', '2026-09-01T12:42:03.321Z'::timestamptz),
  (20, 12, 18, 'Fiber Laser Cutting Machine', 'MCH-LSR-012', 'Bystronic BySprint', 'maintenance', '2026-09-01T12:42:03.321Z'::timestamptz),
  (21, 14, 22, 'Automated SMT Pick & Place Machine', 'MCH-SMT-108', 'Yamaha YSM20R', 'active', '2026-09-01T12:42:03.321Z'::timestamptz),
  (22, 12, 19, 'Robotic Welding Cell B', 'MCH-ROB-004', 'KUKA KR Cybertech', 'active', '2026-09-01T12:42:03.321Z'::timestamptz);
SELECT CASE WHEN pg_get_serial_sequence('machines', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('machines', 'id'), COALESCE((SELECT MAX(id) FROM "machines"), 0) + 1, false) ELSE NULL END;

-- Table: "employees" (6 records)
INSERT INTO "employees" ("id", "name", "employee_code", "branch_id", "user_code", "phone", "email", "is_active", "created_at") VALUES
  (11, 'David Miller', 'EMP-1001', 12, '1001', '+1 555-1001', 'david.miller@company.local', TRUE, '2026-09-01T12:42:03.501Z'::timestamptz),
  (12, 'Sarah Chen', 'EMP-1002', 12, '1002', '+1 555-1002', 'sarah.chen@company.local', TRUE, '2026-09-01T12:42:03.501Z'::timestamptz),
  (13, 'Marcus Vance', 'EMP-1003', 12, '1003', '+1 555-1003', 'marcus.vance@company.local', TRUE, '2026-09-01T12:42:03.501Z'::timestamptz),
  (14, 'Elena Rostova', 'EMP-1004', 12, '1004', '+1 555-1004', 'elena.rostova@company.local', TRUE, '2026-09-01T12:42:03.501Z'::timestamptz),
  (15, 'James Peterson', 'EMP-1005', 13, '1005', '+1 555-1005', 'james.peterson@company.local', TRUE, '2026-09-01T12:42:03.501Z'::timestamptz),
  (16, 'Aoi Takahashi', 'EMP-1006', 14, '1006', '+1 555-1006', 'aoi.takahashi@company.local', TRUE, '2026-09-01T12:42:03.501Z'::timestamptz);
SELECT CASE WHEN pg_get_serial_sequence('employees', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('employees', 'id'), COALESCE((SELECT MAX(id) FROM "employees"), 0) + 1, false) ELSE NULL END;

-- Table: "employee_departments" (7 records)
INSERT INTO "employee_departments" ("id", "employee_id", "department_id", "is_primary", "created_at") VALUES
  (13, 11, 18, TRUE, '2026-09-01T12:42:03.521Z'::timestamptz),
  (14, 11, 19, FALSE, '2026-09-01T12:42:03.521Z'::timestamptz),
  (15, 12, 19, TRUE, '2026-09-01T12:42:03.521Z'::timestamptz),
  (16, 13, 20, TRUE, '2026-09-01T12:42:03.521Z'::timestamptz),
  (17, 14, 18, TRUE, '2026-09-01T12:42:03.521Z'::timestamptz),
  (18, 15, 21, TRUE, '2026-09-01T12:42:03.521Z'::timestamptz),
  (19, 16, 22, TRUE, '2026-09-01T12:42:03.521Z'::timestamptz);
SELECT CASE WHEN pg_get_serial_sequence('employee_departments', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('employee_departments', 'id'), COALESCE((SELECT MAX(id) FROM "employee_departments"), 0) + 1, false) ELSE NULL END;

-- Table: "categories" (7 records)
INSERT INTO "categories" ("id", "name", "code", "type", "description", "created_at") VALUES
  (22, 'Heavy Machinery & Production Equipment', 'CAT-MACH', 'asset', 'Major manufacturing equipment, CNCs, robotic arms and presses', '2026-09-01T12:42:03.339Z'::timestamptz),
  (23, 'Precision Diagnostic & Testing Tools', 'CAT-DIAG', 'asset', 'Calibrated gauges, laser meters, oscilloscopes and multimeters', '2026-09-01T12:42:03.339Z'::timestamptz),
  (24, 'Powered Hand Tools & Equipment', 'CAT-TOOL', 'asset', 'Rotary hammers, torque drills, grinders and pneumatic wrenches', '2026-09-01T12:42:03.339Z'::timestamptz),
  (25, 'Industrial Lubricants & Fluids', 'CAT-LUB', 'consumable', 'Hydraulic oils, slideway greases, synthetic coolants, degreasers', '2026-09-01T12:42:03.339Z'::timestamptz),
  (26, 'Fasteners, Seals & O-Rings', 'CAT-FAST', 'consumable', 'High-tensile bolts, flange gaskets, high-temp silicone seals, O-rings', '2026-09-01T12:42:03.339Z'::timestamptz),
  (27, 'Safety & PPE Consumables', 'CAT-PPE', 'consumable', 'N95 respirators, Kevlar cut-resistant gloves, earplugs, eye shields', '2026-09-01T12:42:03.339Z'::timestamptz),
  (28, 'Chemicals, Adhesives & Threadlockers', 'CAT-CHEM', 'consumable', 'Anaerobic adhesives, thread sealants, industrial epoxies', '2026-09-01T12:42:03.339Z'::timestamptz);
SELECT CASE WHEN pg_get_serial_sequence('categories', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('categories', 'id'), COALESCE((SELECT MAX(id) FROM "categories"), 0) + 1, false) ELSE NULL END;

-- Table: "user_category_permissions" (17 records)
INSERT INTO "user_category_permissions" ("id", "user_id", "category_id", "can_manage", "created_at") VALUES
  (19, 11, 22, TRUE, '2026-09-01T12:42:05.054Z'::timestamptz),
  (20, 11, 23, TRUE, '2026-09-01T12:42:05.054Z'::timestamptz),
  (21, 11, 24, TRUE, '2026-09-01T12:42:05.054Z'::timestamptz),
  (22, 11, 25, TRUE, '2026-09-01T12:42:05.054Z'::timestamptz),
  (23, 11, 26, TRUE, '2026-09-01T12:42:05.054Z'::timestamptz),
  (24, 11, 27, TRUE, '2026-09-01T12:42:05.054Z'::timestamptz),
  (25, 11, 28, TRUE, '2026-09-01T12:42:05.054Z'::timestamptz),
  (26, 12, 22, TRUE, '2026-09-01T12:42:05.054Z'::timestamptz),
  (27, 12, 25, TRUE, '2026-09-01T12:42:05.054Z'::timestamptz),
  (28, 12, 27, TRUE, '2026-09-01T12:42:05.054Z'::timestamptz),
  (29, 19, 28, TRUE, '2026-09-01T13:31:33.347Z'::timestamptz),
  (30, 19, 26, TRUE, '2026-09-01T13:31:33.347Z'::timestamptz),
  (31, 19, 22, TRUE, '2026-09-01T13:31:33.347Z'::timestamptz),
  (32, 19, 25, TRUE, '2026-09-01T13:31:33.347Z'::timestamptz),
  (33, 19, 24, TRUE, '2026-09-01T13:31:33.347Z'::timestamptz),
  (34, 19, 23, TRUE, '2026-09-01T13:31:33.347Z'::timestamptz),
  (35, 19, 27, TRUE, '2026-09-01T13:31:33.347Z'::timestamptz);
SELECT CASE WHEN pg_get_serial_sequence('user_category_permissions', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('user_category_permissions', 'id'), COALESCE((SELECT MAX(id) FROM "user_category_permissions"), 0) + 1, false) ELSE NULL END;

-- Table: "custom_fields" (8 records)
INSERT INTO "custom_fields" ("id", "category_id", "name", "label", "field_type", "options", "is_required", "default_value", "created_at") VALUES
  (24, 22, 'voltage_rating', 'Operating Voltage (V)', 'dropdown', '["110V AC","220V AC","380V 3-Phase","480V 3-Phase"]'::jsonb, TRUE, NULL, '2026-09-01T12:42:03.359Z'::timestamptz),
  (25, 22, 'max_operating_pressure', 'Max Operating Pressure (Bar)', 'number', NULL, FALSE, NULL, '2026-09-01T12:42:03.359Z'::timestamptz),
  (26, 22, 'calibration_interval', 'Inspection Frequency', 'dropdown', '["Monthly","Quarterly","Semi-Annual","Annual"]'::jsonb, TRUE, NULL, '2026-09-01T12:42:03.359Z'::timestamptz),
  (27, 23, 'accuracy_class', 'Accuracy Rating / Tolerance', 'text', NULL, TRUE, NULL, '2026-09-01T12:42:03.359Z'::timestamptz),
  (28, 25, 'viscosity_grade', 'ISO Viscosity Grade', 'dropdown', '["ISO VG 32","ISO VG 46","ISO VG 68","ISO VG 220"]'::jsonb, TRUE, NULL, '2026-09-01T12:42:03.359Z'::timestamptz),
  (29, 25, 'hazard_rating', 'Chemical Hazard Level', 'radio', '["Low / Non-Hazardous","Flammable Class 2","Corrosive"]'::jsonb, TRUE, NULL, '2026-09-01T12:42:03.359Z'::timestamptz),
  (30, 25, 'flash_point', 'Flash Point (°C)', 'number', NULL, FALSE, NULL, '2026-09-01T12:42:03.359Z'::timestamptz),
  (31, 28, 'cure_time', 'Full Cure Time (Hours)', 'number', NULL, FALSE, NULL, '2026-09-01T12:42:03.359Z'::timestamptz);
SELECT CASE WHEN pg_get_serial_sequence('custom_fields', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('custom_fields', 'id'), COALESCE((SELECT MAX(id) FROM "custom_fields"), 0) + 1, false) ELSE NULL END;

-- Table: "field_sets" (3 records)
INSERT INTO "field_sets" ("id", "category_id", "name", "description", "created_at") VALUES
  (11, 22, 'Industrial Machinery Technical Specification', 'Standard electrical and mechanical properties for heavy assets', '2026-09-01T12:42:03.378Z'::timestamptz),
  (12, 25, 'Chemical Fluid & Safety Matrix', 'Safety, viscosity, and storage parameters', '2026-09-01T12:42:03.378Z'::timestamptz),
  (13, 23, 'Precision Calibration Standards', 'Testing accuracy and calibration tracking parameters', '2026-09-01T12:42:03.378Z'::timestamptz);
SELECT CASE WHEN pg_get_serial_sequence('field_sets', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('field_sets', 'id'), COALESCE((SELECT MAX(id) FROM "field_sets"), 0) + 1, false) ELSE NULL END;

-- Table: "field_set_items" (7 records)
INSERT INTO "field_set_items" ("id", "field_set_id", "custom_field_id", "display_order") VALUES
  (22, 11, 24, 1),
  (23, 11, 25, 2),
  (24, 11, 26, 3),
  (25, 12, 28, 1),
  (26, 12, 29, 2),
  (27, 12, 30, 3),
  (28, 13, 27, 1);
SELECT CASE WHEN pg_get_serial_sequence('field_set_items', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('field_set_items', 'id'), COALESCE((SELECT MAX(id) FROM "field_set_items"), 0) + 1, false) ELSE NULL END;

-- Table: "models" (7 records)
INSERT INTO "models" ("id", "category_id", "field_set_id", "name", "model_number", "manufacturer", "description", "created_at", "min_threshold", "image_url", "custom_fields_data") VALUES
  (13, 22, 11, 'DMG Mori CMX-50V CNC', 'MOD-CMX-50V', 'DMG MORI GmbH', 'High precision 5-axis vertical machining center', '2026-09-01T12:42:03.417Z'::timestamptz, 2, NULL, NULL),
  (14, 24, NULL, 'Bosch GBH 8-45 Professional Rotary Hammer', 'MOD-GBH-845', 'Bosch Power Tools', 'Heavy duty SDS-max rotary hammer', '2026-09-01T12:42:03.417Z'::timestamptz, 3, NULL, NULL),
  (15, 23, 13, 'Fluke 87V Industrial True-RMS Multimeter', 'MOD-FLK-87V', 'Fluke Corporation', 'Precision electronic diagnostic meter', '2026-09-01T12:42:03.417Z'::timestamptz, 4, NULL, NULL),
  (16, 25, 12, 'Mobil Vactra Heavy Medium Slideway Oil', 'MOD-MOB-VAC2', 'ExxonMobil Corp', 'Premium slide-way lubricant with anti-stick slip properties', '2026-09-01T12:42:03.417Z'::timestamptz, 50, NULL, NULL),
  (17, 27, NULL, '3M Aura Particulate Respirator 9320+ FFP2', 'MOD-3M-9320', '3M Industrial Safety', 'FFP2 / N95 disposable respirator pack', '2026-09-01T12:42:03.417Z'::timestamptz, 30, NULL, NULL),
  (18, 28, NULL, 'Loctite 243 Medium Strength Threadlocker', 'MOD-LOC-243', 'Henkel AG', 'Anaerobic threadlocking compound 50ml', '2026-09-01T12:42:03.417Z'::timestamptz, 15, NULL, NULL),
  (19, 26, NULL, 'SKF Deep Groove Ball Bearing 6205-2RSH', 'MOD-SKF-6205', 'SKF Group', 'Sealed radial ball bearing for motors and pumps', '2026-09-01T12:42:03.417Z'::timestamptz, 25, NULL, NULL);
SELECT CASE WHEN pg_get_serial_sequence('models', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('models', 'id'), COALESCE((SELECT MAX(id) FROM "models"), 0) + 1, false) ELSE NULL END;

-- Table: "vendors" (4 records)
INSERT INTO "vendors" ("id", "branch_id", "name", "contact_person", "email", "phone", "address", "service_type", "created_at") VALUES
  (8, 12, 'Apex Engineering & Calibration Services', 'Jonathan Vance', 'service@apexengineering.com', '+1 555-7801', '44 Machine Way, Metro Industrial Park', 'supplier_and_repair', '2026-09-01T12:42:03.436Z'::timestamptz),
  (9, 13, 'Precision Hydraulics Overhaul Labs', 'Elena Rodriguez', 'repairs@precisionhydraulics.net', '+1 555-7802', '12 Pressure Blvd, West City', 'repair', '2026-09-01T12:42:03.436Z'::timestamptz),
  (10, 14, 'Global Industrial Polymers & Fasteners Corp', 'David Ross', 'orders@globalfasteners.com', '+1 555-7803', '900 Global Trade Parkway', 'supplier', '2026-09-01T12:42:03.436Z'::timestamptz),
  (11, 12, 'Fluke Certified Metrology & Calibration Labs', 'Sarah Jenkins', 'service@flukecal.com', '+1 555-7804', '77 Test Bench Blvd, North Hub', 'supplier_and_repair', '2026-09-01T12:42:03.436Z'::timestamptz);
SELECT CASE WHEN pg_get_serial_sequence('vendors', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('vendors', 'id'), COALESCE((SELECT MAX(id) FROM "vendors"), 0) + 1, false) ELSE NULL END;

-- Table: "vendor_branch_assignments" (4 records)
INSERT INTO "vendor_branch_assignments" ("id", "vendor_id", "branch_id", "granted_by_user_id", "created_at") VALUES
  (5, 8, 13, 1, '2026-09-01T12:42:03.457Z'::timestamptz),
  (6, 8, 14, 1, '2026-09-01T12:42:03.457Z'::timestamptz),
  (7, 10, 12, 1, '2026-09-01T12:42:03.457Z'::timestamptz),
  (8, 11, 13, 1, '2026-09-01T12:42:03.457Z'::timestamptz);
SELECT CASE WHEN pg_get_serial_sequence('vendor_branch_assignments', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('vendor_branch_assignments', 'id'), COALESCE((SELECT MAX(id) FROM "vendor_branch_assignments"), 0) + 1, false) ELSE NULL END;

-- Table: "request_reasons" (6 records)
INSERT INTO "request_reasons" ("id", "reason", "category_type", "is_active", "created_at") VALUES
  (13, 'Routine Scheduled Maintenance', 'all', TRUE, '2026-09-01T12:42:03.479Z'::timestamptz),
  (14, 'Emergency Machine Breakdown Repair', 'all', TRUE, '2026-09-01T12:42:03.479Z'::timestamptz),
  (15, 'Tool Wear Out / Replacement', 'asset', TRUE, '2026-09-01T12:42:03.479Z'::timestamptz),
  (16, 'Weekly Batch Production Consumable Refill', 'consumable', TRUE, '2026-09-01T12:42:03.479Z'::timestamptz),
  (17, 'Quality Assurance Testing & Calibration', 'all', TRUE, '2026-09-01T12:42:03.479Z'::timestamptz),
  (18, 'Spill Containment & Urgent Safety Measure', 'consumable', TRUE, '2026-09-01T12:42:03.479Z'::timestamptz);
SELECT CASE WHEN pg_get_serial_sequence('request_reasons', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('request_reasons', 'id'), COALESCE((SELECT MAX(id) FROM "request_reasons"), 0) + 1, false) ELSE NULL END;

-- Table: "inventory_items" (11 records)
INSERT INTO "inventory_items" ("id", "code", "name", "item_type", "category_id", "model_id", "supplier_id", "uom", "total_quantity", "available_quantity", "min_threshold", "record_date", "status", "custom_fields_data", "notes", "engagement_status", "first_engaged_at", "last_engaged_at", "total_engagement_minutes", "created_at", "image_url") VALUES
  (17, 'AST-CNC-2024-001', 'DMG Mori 5-Axis Milling Unit Alpha-01', 'asset', 22, 13, 8, 'unit', 1, 1, 2, '2026-01-10', 'available', '{"voltage_rating":"380V 3-Phase","calibration_interval":"Quarterly","max_operating_pressure":120}'::jsonb, 'Primary milling station installed at Shop Floor Bay A1.', 'engaged', '2026-07-03T12:42:05.066Z'::timestamptz, '2026-09-01T12:42:05.066Z'::timestamptz, 86400, '2026-09-01T12:42:05.075Z'::timestamptz, NULL),
  (18, 'AST-CNC-2024-002', 'DMG Mori 5-Axis Milling Unit Alpha-02', 'asset', 22, 13, 8, 'unit', 1, 1, 2, '2026-01-15', 'available', '{"voltage_rating":"380V 3-Phase","calibration_interval":"Quarterly","max_operating_pressure":120}'::jsonb, 'Secondary milling station at Shop Floor Bay A1.', 'idle', NULL, NULL, 43200, '2026-09-01T12:42:05.075Z'::timestamptz, NULL),
  (19, 'AST-HAM-2024-001', 'Bosch SDS-Max Rotary Hammer #01', 'asset', 24, 14, 8, 'unit', 1, 1, 3, '2026-02-01', 'available', '{}'::jsonb, 'Heavy concrete anchoring tool in Workshop Tool Crib.', 'idle', NULL, NULL, 9000, '2026-09-01T12:42:05.075Z'::timestamptz, NULL),
  (20, 'AST-HAM-2024-002', 'Bosch SDS-Max Rotary Hammer #02', 'asset', 24, 14, 8, 'unit', 1, 1, 3, '2026-02-05', 'available', '{}'::jsonb, 'Stored in Tool Crib shelf B.', 'idle', NULL, NULL, 5400, '2026-09-01T12:42:05.075Z'::timestamptz, NULL),
  (21, 'AST-FLK-2024-001', 'Fluke 87V Industrial Multimeter Lab Unit', 'asset', 23, 15, 11, 'unit', 1, 1, 4, '2026-02-12', 'available', '{"accuracy_class":"±0.05% DC Voltage accuracy"}'::jsonb, 'Calibrated multimeter at Quality Testing Lab Bench 2.', 'engaged', '2026-08-12T12:42:05.066Z'::timestamptz, '2026-09-01T12:42:05.066Z'::timestamptz, 28800, '2026-09-01T12:42:05.075Z'::timestamptz, NULL),
  (22, 'AST-FLK-2024-002', 'Fluke 87V Industrial Multimeter Field Unit', 'asset', 23, 15, 11, 'unit', 1, 1, 4, '2026-02-15', 'available', '{"accuracy_class":"±0.05% DC Voltage accuracy"}'::jsonb, 'Field technician diagnostic kit.', 'idle', NULL, NULL, 2700, '2026-09-01T12:42:05.075Z'::timestamptz, NULL),
  (23, 'CON-LUB-MOB-200L', 'Mobil Vactra Slideway Oil No. 2 Drum Batch', 'consumable', 25, 16, 8, 'liter', 200, 35, 50, '2026-03-01', 'low_stock', '{"flash_point":228,"hazard_rating":"Low / Non-Hazardous","viscosity_grade":"ISO VG 68"}'::jsonb, 'Stock level (35 L) is below model minimum threshold (50 L). Automated reorder recommended.', 'idle', NULL, NULL, 0, '2026-09-01T12:42:05.075Z'::timestamptz, NULL),
  (24, 'CON-PPE-N95-BX', '3M Aura FFP2 / N95 Respirator Mask Boxes', 'consumable', 27, 17, 10, 'package', 100, 18, 30, '2026-03-05', 'low_stock', '{}'::jsonb, 'Stock level (18 boxes) is below model minimum threshold (30 boxes). Cleanroom replenishment required.', 'idle', NULL, NULL, 0, '2026-09-01T12:42:05.075Z'::timestamptz, NULL),
  (25, 'CON-LOC-243-50ML', 'Loctite 243 Medium Threadlocker 50ml Bottles', 'consumable', 28, 18, 10, 'bottle', 60, 45, 15, '2026-02-25', 'available', '{"cure_time":24}'::jsonb, 'Standard assembly chemical supplies in good standing.', 'idle', NULL, NULL, 0, '2026-09-01T12:42:05.075Z'::timestamptz, NULL),
  (26, 'CON-BEAR-SKF-6205', 'SKF 6205-2RSH Deep Groove Ball Bearings', 'consumable', 26, 19, 10, 'unit', 50, 12, 25, '2026-02-28', 'low_stock', '{}'::jsonb, 'Motor refurbishment spare parts below 25 unit threshold.', 'idle', NULL, NULL, 0, '2026-09-01T12:42:05.075Z'::timestamptz, NULL),
  (27, 'CON-SEAL-NBR-ROLL', 'Nitrile High-Grade Rubber Gasket Cord 5mm', 'consumable', 26, NULL, 10, 'meter', 500, 320, 60, '2026-02-20', 'available', '{}'::jsonb, 'Continuous roll for chamber sealing.', 'idle', NULL, NULL, 0, '2026-09-01T12:42:05.075Z'::timestamptz, NULL);
SELECT CASE WHEN pg_get_serial_sequence('inventory_items', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('inventory_items', 'id'), COALESCE((SELECT MAX(id) FROM "inventory_items"), 0) + 1, false) ELSE NULL END;

-- Table: "stock_locations" (13 records)
INSERT INTO "stock_locations" ("id", "item_id", "branch_id", "department_id", "location_id", "machine_id", "quantity", "updated_at") VALUES
  (20, 17, 12, 18, 18, 17, 1, '2026-09-01T12:42:05.096Z'::timestamptz),
  (21, 18, 12, 18, 18, NULL, 1, '2026-09-01T12:42:05.096Z'::timestamptz),
  (23, 20, 12, 19, 19, NULL, 1, '2026-09-01T12:42:05.096Z'::timestamptz),
  (24, 21, 12, 20, 20, NULL, 1, '2026-09-01T12:42:05.096Z'::timestamptz),
  (25, 22, 12, 20, 20, NULL, 1, '2026-09-01T12:42:05.096Z'::timestamptz),
  (26, 23, 12, 18, 18, 17, 20, '2026-09-01T12:42:05.096Z'::timestamptz),
  (27, 23, 12, 23, 22, NULL, 15, '2026-09-01T12:42:05.096Z'::timestamptz),
  (28, 24, 12, 20, 20, NULL, 18, '2026-09-01T12:42:05.096Z'::timestamptz),
  (29, 25, 12, 18, 18, NULL, 45, '2026-09-01T12:42:05.096Z'::timestamptz),
  (30, 26, 12, 19, 19, 19, 12, '2026-09-01T12:42:05.096Z'::timestamptz),
  (31, 27, 12, 18, 18, NULL, 320, '2026-09-01T12:42:05.096Z'::timestamptz),
  (22, 19, 12, 19, 19, NULL, 0, '2026-09-01T12:42:05.096Z'::timestamptz),
  (32, 19, 13, 23, NULL, NULL, 1, '2026-09-01T13:41:17.178Z'::timestamptz);
SELECT CASE WHEN pg_get_serial_sequence('stock_locations', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('stock_locations', 'id'), COALESCE((SELECT MAX(id) FROM "stock_locations"), 0) + 1, false) ELSE NULL END;

-- Table: "employee_requests" (3 records)
INSERT INTO "employee_requests" ("id", "request_id", "employee_id", "branch_id", "department_id", "item_id", "requested_qty", "uom", "reason_id", "reason_text", "machine_id", "security_pin_entered", "status", "requested_at", "issued_at", "issued_by_user_id", "manager_notes") VALUES
  (3, 'REQ-2026-001', 11, 12, 18, 23, 10, 'liter', 16, 'Weekly Batch Production Consumable Refill', 17, '1001', 'issued', '2026-08-31T12:42:05.127Z'::timestamptz, '2026-08-31T16:42:05.127Z'::timestamptz, 12, 'Approved and issued 10 Liters of Mobil Vactra Oil to CNC Milling Center.'),
  (4, 'REQ-2026-002', 12, 12, 19, 19, 1, 'unit', 14, 'Emergency Machine Breakdown Repair', 19, '1002', 'pending', '2026-09-01T10:42:05.127Z'::timestamptz, NULL, NULL, NULL),
  (5, 'REQ-2026-003', 14, 12, 18, 24, 5, 'package', 18, 'Spill Containment & Urgent Safety Measure', NULL, '1004', 'approved', '2026-09-01T08:42:05.127Z'::timestamptz, NULL, NULL, 'Approved for assembly team shift PPE replenishment.');
SELECT CASE WHEN pg_get_serial_sequence('employee_requests', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('employee_requests', 'id'), COALESCE((SELECT MAX(id) FROM "employee_requests"), 0) + 1, false) ELSE NULL END;

-- Table: "inventory_movements" (4 records)
INSERT INTO "inventory_movements" ("id", "item_id", "quantity", "uom", "movement_type", "from_branch_id", "to_branch_id", "from_department_id", "to_department_id", "from_location_id", "to_location_id", "to_machine_id", "moved_by_user_id", "notes", "created_at", "status", "accepted_by_user_id", "accepted_at", "rejection_reason") VALUES
  (2, 25, 10, 'bottle', 'branch_to_branch', 12, 13, NULL, 21, NULL, 21, NULL, 10, 'Inter-branch shipment of 10 Loctite bottles for West Hub stock rebalance.', '2026-09-01T06:42:05.108Z'::timestamptz, 'pending_acceptance', NULL, NULL, NULL),
  (3, 23, 20, 'liter', 'location_to_location', 12, 12, NULL, 18, NULL, 18, 17, 12, 'Slideway oil allocated directly to CNC Milling Machine reservoir.', '2026-08-30T12:42:05.108Z'::timestamptz, 'completed', NULL, NULL, NULL),
  (4, 17, 1, 'unit', 'assigned_to_machine', 12, 12, NULL, 18, NULL, 18, 17, 11, 'Assigned asset to primary 5-Axis CNC Milling Center.', '2026-08-22T12:42:05.108Z'::timestamptz, 'completed', NULL, NULL, NULL),
  (5, 19, 1, 'unit', 'branch_to_branch', 12, 13, NULL, 23, NULL, NULL, NULL, 14, '', '2026-09-01T13:00:24.678Z'::timestamptz, 'accepted', 14, '2026-09-01T13:41:17.190Z'::timestamptz, NULL);
SELECT CASE WHEN pg_get_serial_sequence('inventory_movements', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('inventory_movements', 'id'), COALESCE((SELECT MAX(id) FROM "inventory_movements"), 0) + 1, false) ELSE NULL END;

-- Table: "vendor_repairs" (2 records)
INSERT INTO "vendor_repairs" ("id", "item_id", "vendor_id", "branch_id", "sent_date", "expected_return_date", "returned_date", "issue_description", "repair_cost", "status", "engaged_duration_minutes", "manager_notes", "created_at") VALUES
  (2, 20, 8, 12, '2026-02-15', '2026-03-10', NULL, 'Gearbox clutch slipping under heavy drilling load. Precision armature overhaul required.', 165, 'sent_to_vendor', 259200, 'Asset was heavily utilized in tooling workshop before clutch wear.', '2026-09-01T12:42:05.155Z'::timestamptz),
  (3, 22, 11, 12, '2026-01-20', '2026-02-05', '2026-02-04', 'Annual ISO 17025 metrology calibration and test probe replacement.', 85, 'returned', 432000, 'Calibration certificate verified and filed in QA portal.', '2026-09-01T12:42:05.155Z'::timestamptz);
SELECT CASE WHEN pg_get_serial_sequence('vendor_repairs', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('vendor_repairs', 'id'), COALESCE((SELECT MAX(id) FROM "vendor_repairs"), 0) + 1, false) ELSE NULL END;

-- Table: "entry_logs" (15 records)
INSERT INTO "entry_logs" ("id", "user_id", "user_name", "user_role", "branch_id", "action", "entity_type", "entity_id", "details", "created_at") VALUES
  (55, 14, 'Au Finja ERP', 'admin', 12, 'BACKUP_DATABASE', 'SYSTEM_DATABASE', 'backup_1788608887584', 'Admin Au Finja ERP created full database backup (148 records across 25 tables). File: assetflow_db_backup_2026-09-05T11-48-07.json', '2026-09-05T11:48:08.009Z'::timestamptz),
  (56, 1, 'ADMIN User', 'admin', 1, 'BACKUP_DATABASE', 'SYSTEM_DATABASE', 'backup_1788609871084', 'Admin ADMIN User created full database backup (149 records across 25 tables). File: assetflow_db_backup_2026-09-05T12-04-31.json', '2026-09-05T12:04:31.656Z'::timestamptz),
  (57, 1, 'ADMIN User', 'admin', 1, 'BACKUP_DATABASE', 'SYSTEM_DATABASE', 'backup_1788609874535', 'Admin ADMIN User created full database backup (150 records across 25 tables). File: assetflow_db_backup_2026-09-05T12-04-34.json', '2026-09-05T12:04:34.983Z'::timestamptz),
  (58, 1, 'ADMIN User', 'admin', 1, 'BACKUP_DATABASE', 'SYSTEM_DATABASE', 'backup_1788609887728', 'Admin ADMIN User created full PostgreSQL SQL dump (151 records across 25 tables). File: assetflow_db_backup_2026-09-05T12-04-47.sql', '2026-09-05T12:04:48.264Z'::timestamptz),
  (44, 10, 'Arthur Pendelton (Admin)', 'admin', 12, 'INITIALIZE_SYSTEM', 'system', 'SYS-INIT', 'Initial corporate branches, multi-tier departments, asset/consumable categories, and UOM standards configured.', '2026-08-27T12:42:05.168Z'::timestamptz),
  (45, 11, 'Claire Sterling (Super Manager)', 'super_manager', 12, 'CREATE_MODEL_AND_FIELDS', 'model', 'MOD-CMX-50V', 'Created DMG Mori CNC model (Threshold: 2 units) and bound Technical Specifications field set.', '2026-08-29T12:42:05.168Z'::timestamptz),
  (46, 12, 'Robert Fox (Manager)', 'manager', 12, 'ISSUE_REQUEST', 'request', 'REQ-2026-001', 'Issued 10 Liters of Mobil Vactra Oil to Employee David Miller for CNC-501.', '2026-08-31T16:42:05.168Z'::timestamptz),
  (47, 10, 'Arthur Pendelton (Admin)', 'admin', 12, 'STOCK_TRANSFER_INITIATED', 'movement', 'MOV-WEST-REBALANCE', 'Initiated inter-branch stock transfer of 10 Loctite 243 bottles to West Logistics Hub.', '2026-09-01T06:42:05.168Z'::timestamptz),
  (48, 14, 'Au Finja ERP', 'admin', 13, 'INITIATE_BRANCH_TRANSFER', 'movement', '5', 'Initiated branch transfer of 1 unit of Bosch SDS-Max Rotary Hammer #01 (AST-HAM-2024-001) to Branch #13 (Awaiting Manager Acceptance)', '2026-09-01T13:00:24.699Z'::timestamptz),
  (49, 14, 'Au Finja ERP', 'admin', 13, 'CREATE_USER', 'user', '19', 'Created manager user Test (test@aufinja.com) with global or branch access', '2026-09-01T13:31:33.367Z'::timestamptz),
  (50, 19, 'Test', 'manager', 13, 'USER_LOGIN', 'auth', '19', 'User Test (test@aufinja.com) logged in successfully as manager', '2026-09-01T13:31:49.799Z'::timestamptz),
  (51, 14, 'Au Finja ERP', 'manager', 13, 'ACCEPT_BRANCH_TRANSFER', 'movement', '5', 'Branch manager accepted & allocated transfer #5 (1 unit of Bosch SDS-Max Rotary Hammer #01) to Dept #23', '2026-09-01T13:41:17.223Z'::timestamptz),
  (52, 10, 'Arthur Pendelton', 'admin', 12, 'USER_LOGIN', 'auth', '10', 'User Arthur Pendelton (admin) logged in successfully as admin', '2026-09-02T14:39:52.557Z'::timestamptz),
  (53, 14, 'Au Finja ERP', 'admin', 12, 'INIT_DATABASE_TABLES', 'SYSTEM_DATABASE', '0', 'Database tables initialized/verified (22 tables active)', '2026-09-03T16:15:18.085Z'::timestamptz),
  (54, 1, 'ADMIN User', 'admin', 1, 'RESTORE_DATABASE', 'SYSTEM_DATABASE', '147', 'Admin ADMIN User restored database successfully (147 records across 22 tables in 1838ms)', '2026-09-05T11:45:26.718Z'::timestamptz);
SELECT CASE WHEN pg_get_serial_sequence('entry_logs', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('entry_logs', 'id'), COALESCE((SELECT MAX(id) FROM "entry_logs"), 0) + 1, false) ELSE NULL END;

-- Table: "pm_plans" (0 records)
-- (0 records)

-- Table: "pm_schedules" (0 records)
-- (0 records)

-- Table: "pm_work_orders" (0 records)
-- (0 records)

-- Table: "users" (6 records)
INSERT INTO "users" ("id", "uid", "email", "name", "role", "branch_id", "department_id", "user_code", "is_active", "created_at", "password") VALUES
  (11, 'super-001', 'super@company.local', 'Claire Sterling', 'super_manager', 12, 18, '8888', TRUE, '2026-09-01T12:42:05.035Z'::timestamptz, '$2b$12$jjiuqh569tbtd95rxuXfsuiT/IW6T7ChyeqC7H/NhDWvRzqskxCYy'),
  (12, 'mgr-001', 'manager.hq@company.local', 'Robert Fox', 'manager', 12, 18, '7777', TRUE, '2026-09-01T12:42:05.035Z'::timestamptz, '$2b$12$hIn/2.63yR.O6MJaKm2Nc.tzUtabAekGJvbFj7LVJ0JxHBXFLRNF6'),
  (13, 'dept-001', 'dept.prod@company.local', 'Assembly Dept Terminal', 'department', 12, 18, '1001', TRUE, '2026-09-01T12:42:05.035Z'::timestamptz, '$2b$12$Frt8ffHCDQn8mAElOlSCIOuhEMAUs5eVjFQZCexetinLxTv7C2/Sy'),
  (14, 'gbfEf1NI3yZbBTiolIF3uPHV6103', 'erpaufinja@gmail.com', 'Au Finja ERP', 'admin', 1, 1, NULL, TRUE, '2026-09-01T12:43:32.163Z'::timestamptz, '$2b$12$Zy2KqDUSoU8YSJ0aSwzTBu4xq4U3OTF1kKSoqO8rwUfRdpbSYAi7e'),
  (19, 'user_1788269492909_1burw', 'test@aufinja.com', 'Test', 'manager', 13, NULL, NULL, TRUE, '2026-09-01T13:31:33.326Z'::timestamptz, '$2b$12$iBLh86wbl4hZLYe/mJtsWuhYYiZ2PdSLkKi9cBBXgPeesYgIfjV0C'),
  (10, 'admin-001', 'admin', 'Arthur Pendelton', 'admin', 12, 18, '9999', TRUE, '2026-09-01T12:42:05.035Z'::timestamptz, '$2b$12$IdeiiXCF4zMhzMOn9AF47uchiHAlRUUTlIARjie0bkYDd1ZkCwB8u');
SELECT CASE WHEN pg_get_serial_sequence('users', 'id') IS NOT NULL THEN setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM "users"), 0) + 1, false) ELSE NULL END;

COMMIT;

-- End of PostgreSQL Database Dump
