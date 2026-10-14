BEGIN;

ALTER TABLE mlm_generation_commissions
  DROP CONSTRAINT IF EXISTS mlm_generation_commissions_level_no_check;

ALTER TABLE mlm_generation_commissions
  ADD CONSTRAINT mlm_generation_commissions_level_no_check
    CHECK (level_no BETWEEN 0 AND 7),
  ADD COLUMN IF NOT EXISTS team_size_threshold NUMERIC(15,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS mlm_generation_rank_migration (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO mlm_generation_commissions (
  plan_settings_id,
  level_no,
  commission_percent,
  level_name,
  team_size_threshold
)
SELECT p.id, 0, 0, 'Active Partner', 0
FROM mlm_plan_settings p
ON CONFLICT (plan_settings_id, level_no) DO NOTHING;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS current_rank_no INTEGER NOT NULL DEFAULT 0;

ALTER TABLE mlm_rank_rewards
  ADD COLUMN IF NOT EXISTS generation_commission_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM mlm_generation_rank_migration) THEN
    INSERT INTO mlm_generation_commissions (
      plan_settings_id,
      level_no,
      commission_percent,
      level_name,
      team_size_threshold
    )
    SELECT
      r.plan_settings_id,
      r.rank_no,
      COALESCE(gc.commission_percent, 0),
      r.rank_name,
      CASE
        WHEN r.threshold_type = 'team_size' THEN r.milestone_threshold
        ELSE CASE r.rank_no
          WHEN 0 THEN 0
          WHEN 1 THEN 10
          WHEN 2 THEN 100
          WHEN 3 THEN 1000
          WHEN 4 THEN 10000
          WHEN 5 THEN 100000
          WHEN 6 THEN 1000000
          WHEN 7 THEN 11111110
          ELSE 0
        END
      END
    FROM mlm_ranks r
    LEFT JOIN mlm_generation_commissions gc
      ON gc.plan_settings_id = r.plan_settings_id
     AND gc.level_no = r.rank_no
    WHERE r.rank_no BETWEEN 0 AND 7
    ON CONFLICT (plan_settings_id, level_no) DO UPDATE
    SET level_name = EXCLUDED.level_name,
        team_size_threshold = EXCLUDED.team_size_threshold,
        updated_at = CURRENT_TIMESTAMP;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'current_rank_id'
    ) THEN
      UPDATE users u
      SET current_rank_no = COALESCE(r.rank_no, 0)
      FROM mlm_ranks r
      WHERE r.id = u.current_rank_id
        AND r.rank_no BETWEEN 0 AND 7;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'mlm_rank_rewards'
        AND column_name = 'rank_id'
    ) THEN
      EXECUTE '
        UPDATE mlm_rank_rewards rr
        SET generation_commission_id = gc.id
        FROM mlm_ranks r
        JOIN mlm_generation_commissions gc
          ON gc.plan_settings_id = r.plan_settings_id
         AND gc.level_no = r.rank_no
        WHERE rr.rank_id = r.id
          AND rr.generation_commission_id IS NULL';
    END IF;

    INSERT INTO mlm_generation_rank_migration (id) VALUES (TRUE);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'current_rank_id'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_current_rank_id_fkey;
    ALTER TABLE users DROP COLUMN current_rank_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'mlm_rank_rewards'
      AND column_name = 'rank_id'
  ) THEN
    ALTER TABLE mlm_rank_rewards DROP CONSTRAINT IF EXISTS mlm_rank_rewards_rank_id_fkey;
    ALTER TABLE mlm_rank_rewards DROP COLUMN rank_id;
  END IF;
END $$;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_current_rank_no_check;

ALTER TABLE users
  ADD CONSTRAINT users_current_rank_no_check
  CHECK (current_rank_no BETWEEN 0 AND 7);

ALTER TABLE mlm_rank_rewards
  ALTER COLUMN generation_commission_id SET NOT NULL,
  DROP CONSTRAINT IF EXISTS mlm_rank_rewards_generation_commission_id_fkey;

ALTER TABLE mlm_rank_rewards
  ADD CONSTRAINT mlm_rank_rewards_generation_commission_id_fkey
  FOREIGN KEY (generation_commission_id)
  REFERENCES mlm_generation_commissions(id)
  ON DELETE CASCADE;

DROP TABLE IF EXISTS mlm_ranks;

COMMIT;
