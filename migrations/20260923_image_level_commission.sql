BEGIN;

ALTER TABLE mlm_ranks
  ADD COLUMN IF NOT EXISTS team_purchase_threshold NUMERIC(15,2) NOT NULL DEFAULT 0
    CHECK (team_purchase_threshold >= 0),
  ADD COLUMN IF NOT EXISTS level_commission_percent NUMERIC(7,4) NOT NULL DEFAULT 0
    CHECK (level_commission_percent >= 0 AND level_commission_percent <= 100);

UPDATE mlm_plan_settings
SET direct_partner_commission_percent = 0
WHERE is_active = TRUE;

UPDATE mlm_generation_commissions gc
SET commission_percent = v.commission_percent
FROM (VALUES
  (1, 5.00::NUMERIC),
  (2, 4.00::NUMERIC),
  (3, 2.00::NUMERIC),
  (4, 0.50::NUMERIC),
  (5, 0.50::NUMERIC),
  (6, 0.30::NUMERIC),
  (7, 0.20::NUMERIC)
) AS v(level_no, commission_percent)
WHERE gc.level_no = v.level_no
  AND gc.plan_settings_id IN (
    SELECT id FROM mlm_plan_settings WHERE is_active = TRUE
  );

UPDATE mlm_ranks r
SET team_purchase_threshold = v.team_purchase_threshold,
    level_commission_percent = v.level_commission_percent
FROM (VALUES
  (0, 0::NUMERIC, 0::NUMERIC),
  (1, 794.30::NUMERIC, 5.00::NUMERIC),
  (2, 7943.00::NUMERIC, 4.00::NUMERIC),
  (3, 79430.00::NUMERIC, 2.00::NUMERIC),
  (4, 794300.00::NUMERIC, 0.50::NUMERIC),
  (5, 7943000.00::NUMERIC, 0.50::NUMERIC),
  (6, 79430000.00::NUMERIC, 0.30::NUMERIC),
  (7, 7943000000.00::NUMERIC, 0.20::NUMERIC)
) AS v(rank_no, team_purchase_threshold, level_commission_percent)
WHERE r.rank_no = v.rank_no;

COMMIT;
