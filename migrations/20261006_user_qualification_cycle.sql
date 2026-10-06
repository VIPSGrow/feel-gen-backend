BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_qualified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS qualification_cycle_start TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS downline_purchased_count INTEGER NOT NULL DEFAULT 0;

-- One row per (upline, buyer, cycle): guarantees unique-member counting and
-- makes webhook/order retries idempotent.
CREATE TABLE IF NOT EXISTS qualification_cycle_purchases (
  id BIGSERIAL PRIMARY KEY,
  upline_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  cycle_start TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_qualification_upline_buyer_cycle UNIQUE (upline_id, buyer_id, cycle_start)
);

CREATE INDEX IF NOT EXISTS idx_users_qualification_cycle_start
  ON users (qualification_cycle_start);

COMMIT;
