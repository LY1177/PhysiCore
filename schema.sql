-- PhysiCore schema (SQLite)
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_level INTEGER NOT NULL,
  topic TEXT NOT NULL,
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 1,
  explanation TEXT,
  solution_steps TEXT
);

CREATE TABLE IF NOT EXISTS results (
  user_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  chosen_index INTEGER NOT NULL,
  is_correct INTEGER NOT NULL,
  points_earned INTEGER NOT NULL DEFAULT 0,
  answered_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, task_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
