BEGIN;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE transactions
SET completed_at = created_at
WHERE status = 'completed'
  AND completed_at IS NULL;

COMMIT;
