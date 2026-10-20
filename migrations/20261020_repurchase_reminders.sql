CREATE TABLE IF NOT EXISTS repurchase_reminders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_purchase_at TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | completed
  notified_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  dismissed_until TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, last_purchase_at)
);

CREATE INDEX IF NOT EXISTS idx_repurchase_reminders_user_status
  ON repurchase_reminders (user_id, status);
