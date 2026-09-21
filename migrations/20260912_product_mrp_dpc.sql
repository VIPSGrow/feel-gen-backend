ALTER TABLE products ADD COLUMN IF NOT EXISTS mrp_percentage NUMERIC(5,2) DEFAULT 0.00 CHECK (mrp_percentage >= 0 AND mrp_percentage <= 100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS dpc_percentage NUMERIC(5,2) DEFAULT 0.00 CHECK (dpc_percentage >= 0 AND dpc_percentage <= 100);
