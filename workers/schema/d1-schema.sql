-- Players
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  total_xp INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  last_played_date TEXT,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Game Results
CREATE TABLE IF NOT EXISTS game_results (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  game_id TEXT NOT NULL,
  game_date TEXT NOT NULL,
  score INTEGER NOT NULL,
  placement INTEGER,
  xp_earned INTEGER DEFAULT 0,
  duration_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_game_results_player ON game_results(player_id);
CREATE INDEX IF NOT EXISTS idx_game_results_date ON game_results(game_date);

-- Daily Leaderboard (materialized)
CREATE TABLE IF NOT EXISTS daily_leaderboard (
  game_date TEXT NOT NULL,
  player_id TEXT NOT NULL REFERENCES players(id),
  best_score INTEGER NOT NULL,
  rank INTEGER,
  PRIMARY KEY (game_date, player_id)
);

-- Trophies
CREATE TABLE IF NOT EXISTS trophies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  criteria_type TEXT NOT NULL,
  criteria_value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player_trophies (
  player_id TEXT NOT NULL REFERENCES players(id),
  trophy_id TEXT NOT NULL REFERENCES trophies(id),
  earned_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (player_id, trophy_id)
);

-- Seed trophies
INSERT OR IGNORE INTO trophies (id, name, description, icon, criteria_type, criteria_value) VALUES
  ('first-win', 'First Victory', 'Win your first game', 'trophy.fill', 'wins', 1),
  ('streak-7', 'Week Warrior', 'Play 7 days in a row', 'flame.fill', 'streak', 7),
  ('streak-30', 'Monthly Master', 'Play 30 days in a row', 'flame.fill', 'streak', 30),
  ('games-100', 'Centurion', 'Play 100 games', 'star.fill', 'games_played', 100),
  ('xp-1000', 'XP Hunter', 'Earn 1000 XP', 'bolt.fill', 'total_xp', 1000);
