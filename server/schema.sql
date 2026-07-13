-- 老師 vs 學生（重製版）排行榜資料表
-- 在 Neon 的 SQL Editor 貼上整份執行即可

CREATE TABLE IF NOT EXISTS single_scores (
  id SERIAL PRIMARY KEY,
  player_name TEXT NOT NULL,
  score INT NOT NULL,
  played_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS duo_matches (
  id SERIAL PRIMARY KEY,
  student_name TEXT NOT NULL,
  disruptor_name TEXT NOT NULL,
  score INT NOT NULL,
  winner TEXT NOT NULL CHECK (winner IN ('student', 'disruptor')),
  played_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_single_scores_score ON single_scores (score DESC);
CREATE INDEX IF NOT EXISTS idx_duo_matches_played_at ON duo_matches (played_at DESC);
