PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_level INTEGER NOT NULL,        -- 8, 9, 10
  topic TEXT NOT NULL,                 -- e.g. "Кинематика"
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,          -- JSON array
  correct_index INTEGER NOT NULL,      -- 0..3
  explanation TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  chosen_index INTEGER NOT NULL,
  is_correct INTEGER NOT NULL,         -- 0/1
  points_earned INTEGER NOT NULL,
  answered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, task_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

