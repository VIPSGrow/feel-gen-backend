-- Track Razorpay linkage so unpaid online orders can be cancelled / expired safely
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(64);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(64);
-- Cart is cleared only after payment succeeds (set for online-payment orders created from the cart)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS clear_cart_on_paid BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON public.orders (razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_unpaid_online
  ON public.orders (created_at)
  WHERE payment_status = 'unpaid' AND payment_method = 'razorpay';
