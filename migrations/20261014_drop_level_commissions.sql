-- level_commissions is replaced by mlm_generation_commissions.
-- Capping and milestone tables now reference mlm_generation_commissions(id).
BEGIN;

ALTER TABLE level_cappings DROP CONSTRAINT IF EXISTS fk_level;
ALTER TABLE level_milestones DROP CONSTRAINT IF EXISTS fk_milestone_level;

-- Old ids pointed at level_commissions rows, so they are invalid now.
DELETE FROM level_cappings;
DELETE FROM level_milestones;

ALTER TABLE level_cappings
  ADD CONSTRAINT fk_level FOREIGN KEY (level_id)
  REFERENCES mlm_generation_commissions(id) ON DELETE CASCADE;

ALTER TABLE level_milestones
  ADD CONSTRAINT fk_milestone_level FOREIGN KEY (level_id)
  REFERENCES mlm_generation_commissions(id) ON DELETE CASCADE;

DROP TABLE IF EXISTS level_commissions;

COMMIT;
