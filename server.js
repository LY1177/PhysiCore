const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const { initDb } = require("./database");
const app = express();
const db = initDb();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "physicore_super_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 }, // 7 дни
  })
);

app.use(express.static(path.join(__dirname, "public")));

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Not authenticated" });
  next();
}
/*---*/
function runSQL(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (kind === "pg") {
      db.query(sql, params)
        .then((r) => resolve(r))
        .catch(reject);
    } else {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this); // this.lastID
      });
    }
  });
}

function getSQL(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (kind === "pg") {
      db.query(sql, params)
        .then((r) => resolve(r.rows[0] || null))
        .catch(reject);
    } else {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    }
  });
}

/* ---------------- AUTH ---------------- */

app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Моля попълни всички полета." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Паролата трябва да е поне 6 символа." });
    }

    const password_hash = await bcrypt.hash(password, 10);

    db.run(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [username.trim(), email.trim().toLowerCase(), password_hash],
      function (err) {
        if (err) {
          const msg = String(err.message || "");
          if (msg.includes("UNIQUE")) {
            return res.status(409).json({ error: "Потребител или имейл вече съществува." });
          }
          return res.status(500).json({ error: "Грешка при регистрация." });
        }

        req.session.user = { id: this.lastID, username: username.trim() };
        return res.json({ ok: true, user: req.session.user });
      }
    );
  } catch (e) {
    return res.status(500).json({ error: "Сървърна грешка." });
  }
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Липсват данни." });

  db.get("SELECT id, username, password_hash FROM users WHERE email = ?", [email.trim().toLowerCase()], async (err, row) => {
    if (err) return res.status(500).json({ error: "Сървърна грешка." });
    if (!row) return res.status(401).json({ error: "Невалиден имейл или парола." });

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "Невалиден имейл или парола." });

    req.session.user = { id: row.id, username: row.username };
    return res.json({ ok: true, user: req.session.user });
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});
/*----*/
app.post("/api/register", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (username.length < 3) {
      return res.status(400).json({ error: "Потребителското име трябва да е поне 3 символа." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Паролата трябва да е поне 6 символа." });
    }

    // 1) проверка дали съществува
    const existing =
      kind === "pg"
        ? await getSQL("SELECT id FROM users WHERE username = $1", [username])
        : await getSQL("SELECT id FROM users WHERE username = ?", [username]);

    if (existing) {
      return res.status(409).json({ error: "Този потребител вече съществува." });
    }

    // 2) хеширане
    const passwordHash = await bcrypt.hash(password, 10);

    // 3) insert
    let newUserId;

    if (kind === "pg") {
      const r = await runSQL(
        "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id",
        [username, passwordHash]
      );
      newUserId = r.rows[0].id;
    } else {
      const r = await runSQL(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
        [username, passwordHash]
      );
      newUserId = r.lastID;
    }

    // 4) login след регистрация
    req.session.user = { id: newUserId, username };

    return res.json({ ok: true, user: { id: newUserId, username } });
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    return res.status(500).json({ error: "Грешка при регистрация." });
  }
});

/* ---------------- TASKS ---------------- */

app.get("/api/topics", requireAuth, (req, res) => {
  const classLevel = Number(req.query.class);
  if (![8, 9, 10].includes(classLevel)) return res.status(400).json({ error: "Невалиден клас." });

  db.all(
    "SELECT DISTINCT topic FROM tasks WHERE class_level = ? ORDER BY topic ASC",
    [classLevel],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Грешка при теми." });
      res.json({ topics: rows.map((r) => r.topic) });
    }
  );
});

app.get("/api/tasks", requireAuth, (req, res) => {
  const classLevel = Number(req.query.class);
  const topic = String(req.query.topic || "").trim();
  if (![8, 9, 10].includes(classLevel) || !topic) return res.status(400).json({ error: "Невалидни параметри." });

  db.all(
    "SELECT id, class_level, topic, question, options_json, points FROM tasks WHERE class_level = ? AND topic = ? ORDER BY id ASC",
    [classLevel, topic],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Грешка при задачи." });
      const tasks = rows.map((t) => ({
        id: t.id,
        class_level: t.class_level,
        topic: t.topic,
        question: t.question,
        options: JSON.parse(t.options_json),
        points: t.points,
      }));
      res.json({ tasks });
    }
  );
});

app.post("/api/submit", requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const taskId = Number(req.body.taskId);
  const chosenIndex = Number(req.body.chosenIndex);

  if (!taskId || Number.isNaN(chosenIndex) || chosenIndex < 0 || chosenIndex > 10) {
    return res.status(400).json({ error: "Невалидни данни." });
  }

  db.get("SELECT id, correct_index, explanation, points FROM tasks WHERE id = ?", [taskId], (err, task) => {
    if (err || !task) return res.status(404).json({ error: "Задачата не е намерена." });

    const isCorrect = chosenIndex === task.correct_index ? 1 : 0;
    const pointsEarned = isCorrect ? task.points : 0;

    db.run(
      `INSERT INTO results (user_id, task_id, chosen_index, is_correct, points_earned)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, task_id) DO UPDATE SET
         chosen_index=excluded.chosen_index,
         is_correct=excluded.is_correct,
         points_earned=excluded.points_earned,
         answered_at=datetime('now')`,
      [userId, taskId, chosenIndex, isCorrect, pointsEarned],
      (e2) => {
        if (e2) return res.status(500).json({ error: "Неуспешно записване на резултат." });
        res.json({ ok: true, isCorrect: !!isCorrect, pointsEarned, explanation: task.explanation });
      }
    );
  });
});


app.get("/api/stats", requireAuth, (req, res) => {
  const userId = req.session.user.id;

  db.get(
    `SELECT
       COALESCE(SUM(points_earned),0) AS totalPoints,
       COALESCE(SUM(is_correct),0) AS correctCount,
       COALESCE(SUM(CASE WHEN is_correct=0 THEN 1 ELSE 0 END),0) AS wrongCount,
       COALESCE(COUNT(*),0) AS answeredCount
     FROM results
     WHERE user_id = ?`,
    [userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: "Грешка при статистика." });
      res.json({ stats: row });
    }
  );
});
app.get("/handbook", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "handbook.html"));
});
app.get("/test", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "test.html"));
});

app.get("/igra", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "igra.html"));
});

app.get("/admin/users", async (req, res) => {
  // ⚠️ временно, само за теб
  const users = await db.query(
    "SELECT id, username, created_at FROM users"
  );
  res.json(users.rows);
});

/* ---------------- FALLBACK ROUTES ---------------- */
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/solve", (req, res) => res.sendFile(path.join(__dirname, "public", "solve.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PhysiCore running on http://localhost:${PORT}`));
