BEGIN;

ALTER TABLE mlm_plan_settings
  ADD COLUMN IF NOT EXISTS holding_period_minutes INTEGER NOT NULL DEFAULT 5
  CHECK (holding_period_minutes >= 0);

COMMENT ON COLUMN mlm_plan_settings.holding_period_minutes IS
  'Hold commissions for N minutes after creation before releasing to withdrawable wallet (5 = 5 min release)';

UPDATE mlm_plan_settings
SET holding_period_minutes = 5
WHERE is_active = TRUE;

ALTER TABLE users
  ALTER COLUMN is_active SET DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'left_count'
  ) THEN
    ALTER TABLE wallets ADD COLUMN left_count INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'right_count'
  ) THEN
    ALTER TABLE wallets ADD COLUMN right_count INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'paid_pairs'
  ) THEN
    ALTER TABLE wallets ADD COLUMN paid_pairs INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'company_fund'
  ) THEN
    ALTER TABLE wallets ADD COLUMN company_fund NUMERIC(15,2) DEFAULT 0.00;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'withdrawable_amount'
  ) THEN
    ALTER TABLE wallets ADD COLUMN withdrawable_amount NUMERIC(15,2) DEFAULT 0.00;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_packages' AND column_name = 'razorpay_order_id'
  ) THEN
    ALTER TABLE user_packages ADD COLUMN razorpay_order_id VARCHAR(255);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'user_package_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN user_package_id INTEGER
      REFERENCES user_packages(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'mlm_source_user_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN mlm_source_user_id INTEGER
      REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'mlm_eligible'
  ) THEN
    ALTER TABLE orders ADD COLUMN mlm_eligible BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'mlm_order_type'
  ) THEN
    ALTER TABLE orders ADD COLUMN mlm_order_type VARCHAR(50);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mlm_commission_events' AND column_name = 'mlm_order_type'
  ) THEN
    ALTER TABLE mlm_commission_events ADD COLUMN mlm_order_type VARCHAR(50);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mlm_commission_events' AND column_name = 'is_self_commission'
  ) THEN
    ALTER TABLE mlm_commission_events ADD COLUMN is_self_commission BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mlm_commission_events' AND column_name = 'parent_chain_stage'
  ) THEN
    ALTER TABLE mlm_commission_events ADD COLUMN parent_chain_stage VARCHAR(20)
      DEFAULT 'unilevel';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'category'
  ) THEN
    ALTER TABLE transactions ADD COLUMN category VARCHAR(50) DEFAULT 'commission';
  END IF;
END $$;

INSERT INTO level_commissions (level_no, commission_percentage, level_name)
VALUES (0, 3.00, 'Self Cashback')
ON CONFLICT (level_no) DO NOTHING;

INSERT INTO mlm_generation_commissions
  (plan_settings_id, level_no, commission_percent, level_name)
SELECT ps.id, lvl.l, lvl.p, lvl.n
FROM mlm_plan_settings ps
CROSS JOIN (
  SELECT 1 AS l, 5.00 AS p, 'Generation Level 1' AS n UNION ALL
  SELECT 2, 4.00, 'Generation Level 2' UNION ALL
  SELECT 3, 2.00, 'Generation Level 3' UNION ALL
  SELECT 4, 1.00, 'Generation Level 4' UNION ALL
  SELECT 5, 0.50, 'Generation Level 5' UNION ALL
  SELECT 6, 0.25, 'Generation Level 6' UNION ALL
  SELECT 7, 0.25, 'Generation Level 7'
) lvl
WHERE ps.is_active = TRUE
ON CONFLICT (plan_settings_id, level_no) DO NOTHING;

COMMIT;
