BEGIN;

CREATE TABLE IF NOT EXISTS mlm_plan_settings (
  id BIGSERIAL PRIMARY KEY,
  plan_version INTEGER NOT NULL DEFAULT 1,
  mrp NUMERIC(15,2) NOT NULL CHECK (mrp >= 0),
  direct_partner_commission_percent NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (direct_partner_commission_percent >= 0 AND direct_partner_commission_percent <= 100),
  distributor_price NUMERIC(15,2) NOT NULL CHECK (distributor_price >= 0),
  distributor_price_mode VARCHAR(20) NOT NULL DEFAULT 'fixed' CHECK (distributor_price_mode IN ('fixed', 'mrp_less_percent')),
  distributor_price_percent NUMERIC(7,4) CHECK (distributor_price_percent IS NULL OR (distributor_price_percent >= 0 AND distributor_price_percent <= 100)),
  packets_per_package INTEGER NOT NULL DEFAULT 1 CHECK (packets_per_package > 0),
  holding_period_days INTEGER NOT NULL DEFAULT 0 CHECK (holding_period_days >= 0),
  max_generation_level INTEGER NOT NULL DEFAULT 7 CHECK (max_generation_level BETWEEN 1 AND 7),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mlm_plan_settings_active
  ON mlm_plan_settings (is_active)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS mlm_generation_commissions (
  id BIGSERIAL PRIMARY KEY,
  plan_settings_id BIGINT NOT NULL REFERENCES mlm_plan_settings(id) ON DELETE CASCADE,
  level_no INTEGER NOT NULL CHECK (level_no BETWEEN 1 AND 7),
  commission_percent NUMERIC(7,4) NOT NULL CHECK (commission_percent >= 0 AND commission_percent <= 100),
  level_name VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (plan_settings_id, level_no)
);

CREATE TABLE IF NOT EXISTS mlm_ranks (
  id BIGSERIAL PRIMARY KEY,
  plan_settings_id BIGINT NOT NULL REFERENCES mlm_plan_settings(id) ON DELETE CASCADE,
  rank_no INTEGER NOT NULL CHECK (rank_no >= 0),
  rank_name VARCHAR(150) NOT NULL,
  milestone_threshold NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (milestone_threshold >= 0),
  threshold_type VARCHAR(30) NOT NULL DEFAULT 'team_size',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (plan_settings_id, rank_no),
  UNIQUE (plan_settings_id, rank_name)
);

CREATE TABLE IF NOT EXISTS mlm_rank_rewards (
  id BIGSERIAL PRIMARY KEY,
  rank_id BIGINT NOT NULL REFERENCES mlm_ranks(id) ON DELETE CASCADE,
  reward_type VARCHAR(40) NOT NULL,
  reward_value NUMERIC(15,2),
  reward_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mlm_commission_events (
  id BIGSERIAL PRIMARY KEY,
  order_id INTEGER,
  user_package_id INTEGER,
  source_user_id INTEGER NOT NULL REFERENCES users(id),
  beneficiary_user_id INTEGER NOT NULL REFERENCES users(id),
  commission_type VARCHAR(40) NOT NULL,
  generation_level INTEGER NOT NULL CHECK (generation_level BETWEEN 0 AND 7),
  base_amount NUMERIC(15,2) NOT NULL CHECK (base_amount >= 0),
  commission_percent NUMERIC(7,4) NOT NULL CHECK (commission_percent >= 0 AND commission_percent <= 100),
  commission_amount NUMERIC(15,2) NOT NULL CHECK (commission_amount >= 0),
  plan_settings_id BIGINT REFERENCES mlm_plan_settings(id),
  transaction_id INTEGER REFERENCES transactions(id),
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mlm_commission_event_order
  ON mlm_commission_events (order_id, beneficiary_user_id, commission_type, generation_level)
  WHERE order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mlm_commission_event_package
  ON mlm_commission_events (user_package_id, beneficiary_user_id, commission_type, generation_level)
  WHERE user_package_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mlm_commission_events_source
  ON mlm_commission_events (source_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_mlm_commission_events_beneficiary
  ON mlm_commission_events (beneficiary_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_users_referrer_id
  ON users (referrer_id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS initiator_user_id INTEGER;

INSERT INTO mlm_plan_settings (
  plan_version,
  mrp,
  direct_partner_commission_percent,
  distributor_price,
  distributor_price_mode,
  distributor_price_percent,
  packets_per_package,
  holding_period_days,
  max_generation_level
)
SELECT 1, 139.00, 7.00, 129.27, 'fixed', NULL, 5, 30, 7
WHERE NOT EXISTS (SELECT 1 FROM mlm_plan_settings);

INSERT INTO mlm_generation_commissions (plan_settings_id, level_no, commission_percent, level_name)
SELECT p.id, v.level_no, v.commission_percent, v.level_name
FROM mlm_plan_settings p
CROSS JOIN (VALUES
  (1, 5.00::NUMERIC, 'Team Builder'),
  (2, 4.00::NUMERIC, 'Senior Builder'),
  (3, 2.00::NUMERIC, 'Star Leader'),
  (4, 1.00::NUMERIC, 'Silver Leader'),
  (5, 0.50::NUMERIC, 'Gold Achiever'),
  (6, 0.25::NUMERIC, 'Platinum Executive'),
  (7, 0.25::NUMERIC, 'Diamond Director')
) AS v(level_no, commission_percent, level_name)
ON CONFLICT (plan_settings_id, level_no) DO NOTHING;

INSERT INTO mlm_ranks (plan_settings_id, rank_no, rank_name, milestone_threshold)
SELECT p.id, v.rank_no, v.rank_name, v.milestone_threshold
FROM mlm_plan_settings p
CROSS JOIN (VALUES
  (0, 'Active Partner', 0::NUMERIC),
  (1, 'Team Builder', 10::NUMERIC),
  (2, 'Senior Builder', 100::NUMERIC),
  (3, 'Star Leader', 1000::NUMERIC),
  (4, 'Silver Leader', 10000::NUMERIC),
  (5, 'Gold Achiever', 100000::NUMERIC),
  (6, 'Platinum Executive', 1000000::NUMERIC),
  (7, 'Diamond Director', 11111110::NUMERIC)
) AS v(rank_no, rank_name, milestone_threshold)
ON CONFLICT (plan_settings_id, rank_no) DO NOTHING;

COMMIT;
