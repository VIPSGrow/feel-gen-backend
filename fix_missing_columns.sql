-- Run these ALTER TABLE statements on your actual database to sync schema
-- Run via: psql -d your_db_name -f fix_missing_columns.sql

ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(30);
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC(12,3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS dimension_length NUMERIC(12,3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS dimension_width NUMERIC(12,3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS dimension_height NUMERIC(12,3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS dimension_unit VARCHAR(20);
ALTER TABLE products ADD COLUMN IF NOT EXISTS mrp_percentage NUMERIC(5,2) DEFAULT 0.00 CHECK (mrp_percentage >= 0 AND mrp_percentage <= 100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS dpc_percentage NUMERIC(5,2) DEFAULT 0.00 CHECK (dpc_percentage >= 0 AND dpc_percentage <= 100);
