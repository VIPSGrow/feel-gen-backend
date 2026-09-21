-- Add invoice_no and receipt_no columns to orders table
-- Create invoice_settings table for sequence counter

ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_no VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_no VARCHAR(50);

CREATE TABLE IF NOT EXISTS invoice_settings (
    id SERIAL PRIMARY KEY,
    last_sno INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Initialize the sequence counter with 0
INSERT INTO invoice_settings (last_sno) VALUES (0)
ON CONFLICT (id) DO NOTHING;