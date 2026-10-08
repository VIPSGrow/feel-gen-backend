-- Split payment support: track paid amount and individual payment records
-- Allows orders to be paid via wallet only, razorpay only, or a split combination

-- Track how much of the order total has actually been paid (sum of all payment methods)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12, 2) DEFAULT 0.00;

-- Ensure payment_status column exists (some databases may be missing it)
-- Values: 'unpaid', 'partially_paid', 'paid', 'refunded'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid';

CREATE TABLE IF NOT EXISTS distributor_order_payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    payment_method VARCHAR(50),           -- 'wallet', 'razorpay', etc.
    amount DECIMAL(12, 2) NOT NULL,     -- portion paid via this method
    transaction_id VARCHAR(255),          -- razorpay_payment_id or txn ref
    status VARCHAR(20) DEFAULT 'completed',
    payment_details JSONB,               -- razorpay_order_id, signature, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_distributor_order_payments_order_id
    ON distributor_order_payments (order_id);

CREATE INDEX IF NOT EXISTS idx_distributor_order_payments_user_id
    ON distributor_order_payments (user_id);
