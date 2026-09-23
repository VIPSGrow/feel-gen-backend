BEGIN;

WITH active_plan AS (
  SELECT id
  FROM mlm_plan_settings
  WHERE is_active = TRUE
  ORDER BY effective_from DESC
  LIMIT 1
), rank_values (rank_no, rank_name, milestone_threshold) AS (
  VALUES
    (0, 'Distributor', 1000::NUMERIC),
    (1, 'Silver', 5000::NUMERIC),
    (2, 'Gold', 15000::NUMERIC),
    (3, 'Platinum', 50000::NUMERIC),
    (4, 'Diamond', 100000::NUMERIC)
)
INSERT INTO mlm_ranks (
  plan_settings_id,
  rank_no,
  rank_name,
  milestone_threshold,
  threshold_type
)
SELECT p.id, v.rank_no, v.rank_name, v.milestone_threshold, 'amount'
FROM active_plan p
CROSS JOIN rank_values v
ON CONFLICT (plan_settings_id, rank_no) DO UPDATE
SET rank_name = EXCLUDED.rank_name,
    milestone_threshold = EXCLUDED.milestone_threshold,
    threshold_type = EXCLUDED.threshold_type,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;

COMMIT;