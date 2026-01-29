const path = require("path");
const fs = require("fs");

if (process.env.DATABASE_URL) {
  // =========================
  // 👉 Render / PostgreSQL
  // =========================
  const { Pool } = require("pg");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  async function initDb() {
    const schema = fs.readFileSync(
      path.join(__dirname, "schema.sql"),
      "utf-8"
    );
    await pool.query(schema);
    return pool;
  }

  module.exports = { initDb, kind: "pg" };
} else {
  // =========================
  // 👉 Local / SQLite
  // =========================
  const sqlite3 = require("sqlite3").verbose();
  const DB_PATH = path.join(__dirname, "database.db");
  const SCHEMA_PATH = path.join(__dirname, "schema.sql");

  function openDb() {
    const db = new sqlite3.Database(DB_PATH);
    db.run("PRAGMA foreign_keys = ON;");
    return db;
  }

  function initDb() {
    const db = openDb();
    const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
    db.exec(schema, (err) => {
      if (err) console.error("Schema init error:", err);
    });
    return db;
  }

  module.exports = { initDb, kind: "sqlite" };
}
