CREATE TABLE IF NOT EXISTS rank_achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rank_no INTEGER NOT NULL,
  rank_name TEXT NOT NULL,
  rewards JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_seen BOOLEAN NOT NULL DEFAULT FALSE,
  achieved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  seen_at TIMESTAMP,
  UNIQUE (user_id, rank_no)
);

CREATE INDEX IF NOT EXISTS idx_rank_achievements_pending
  ON rank_achievements (user_id) WHERE is_seen = FALSE;
