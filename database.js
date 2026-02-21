const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const DB_PATH = path.join(__dirname, "database.db");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

function openDb() {
  const db = new sqlite3.Database(DB_PATH);
  db.run("PRAGMA foreign_keys = ON;");
  return db;
}

function ensureUserRoleColumn(db) {
 
  db.all("PRAGMA table_info(users);", (err, rows) => {
    if (err || !rows) return;
    const hasRole = rows.some((r) => r.name === "role");
    if (hasRole) return;

    db.run("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student';", (e2) => {
      if (e2) console.error("Role column migrate error:", e2.message || e2);
    });
  });
}

function initDb() {
  const db = openDb();
  try {
    const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
    if (schema && schema.trim()) {
      db.exec(schema, (err) => {
        if (err) console.error("Schema init error:", err);
        ensureUserRoleColumn(db);
      });
    } else {
      ensureUserRoleColumn(db);
    }
  } catch (e) {
    ensureUserRoleColumn(db);
  }
  return db;
}

module.exports = { initDb };
