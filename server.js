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
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 }, 
  })
);

app.use(express.static(path.join(__dirname, "public")));

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Not authenticated" });
  next();
}

function requireTeacher(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.session.user.role !== "teacher") return res.status(403).json({ error: "Forbidden" });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.session.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
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
      "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [username.trim(), email.trim().toLowerCase(), password_hash, "student"],
      function (err) {
        if (err) {
          const msg = String(err.message || "");
          if (msg.includes("UNIQUE")) {
            return res.status(409).json({ error: "Потребител или имейл вече съществува." });
          }
          return res.status(500).json({ error: "Грешка при регистрация." });
        }

        req.session.user = { id: this.lastID, username: username.trim(), role: "student" };
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

  db.get(
    "SELECT id, username, password_hash, role FROM users WHERE email = ?",
    [email.trim().toLowerCase()],
    async (err, row) => {
      if (err) return res.status(500).json({ error: "Сървърна грешка." });
      if (!row) return res.status(401).json({ error: "Невалиден имейл или парола." });

      const ok = await bcrypt.compare(password, row.password_hash);
      if (!ok) return res.status(401).json({ error: "Невалиден имейл или парола." });

      req.session.user = {id: row.id, username: row.username, role: row.role ?? "student"};

      return res.json({ ok: true, user: req.session.user });
    }
  );
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.json({ user: null });

  db.get(
    "SELECT id, username, role FROM users WHERE id = ?",
    [req.session.user.id],
    (err, row) => {
      if (err || !row) return res.json({ user: req.session.user });

      const role = String(row.role || "student").trim().toLowerCase();
      req.session.user.role = role;

      res.json({
        user: { id: row.id, username: row.username, role }
      });
    }
  );
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


app.get("/api/random-test", requireAuth, (req, res) => {
  const classLevel = Number(req.query.class);
  const count = Math.max(1, Math.min(50, Number(req.query.count || 10)));
  if (![8, 9, 10].includes(classLevel)) return res.status(400).json({ error: "Невалиден клас." });

  db.all(
    "SELECT id, class_level, topic, question, options_json, points FROM tasks WHERE class_level = ? ORDER BY RANDOM() LIMIT ?",
    [classLevel, count],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Грешка при генериране на тест." });
      const tasks = rows.map((t) => ({
        id: t.id,
        class_level: t.class_level,
        topic: t.topic,
        question: t.question,
        options: JSON.parse(t.options_json),
        points: t.points,
      }));
      res.json({ tasks, classLevel, count: tasks.length });
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

/* ---------------- TEACHER MODE ---------------- */

app.get("/teacher", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  if (req.session.user.role !== "teacher") return res.redirect("/");
  return res.sendFile(path.join(__dirname, "public", "teacher.html"));
});

app.get("/api/teacher/overview", requireTeacher, (req, res) => {
  const sql = `
    SELECT t.topic,
           COUNT(r.task_id) AS attempts,
           SUM(CASE WHEN r.is_correct = 0 THEN 1 ELSE 0 END) AS wrongs
    FROM results r
    JOIN tasks t ON t.id = r.task_id
    GROUP BY t.topic
    ORDER BY wrongs DESC, attempts DESC
    LIMIT 12;
  `;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json({ topWrongTopics: rows });
  });
});


app.get("/api/teacher/leaderboard", requireTeacher, (req, res) => {
  const sql = `
    SELECT u.username,
           COALESCE(SUM(r.points_earned), 0) AS points,
           COALESCE(SUM(r.is_correct), 0) AS correct,
           COALESCE(SUM(CASE WHEN r.is_correct=0 THEN 1 ELSE 0 END), 0) AS wrong
    FROM users u
    LEFT JOIN results r ON r.user_id = u.id
    GROUP BY u.id
    ORDER BY points DESC, correct DESC
    LIMIT 25;
  `;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json({ leaderboard: rows });
  });
});


app.get("/api/teacher/users", requireTeacher, (req, res) => {
  db.all(
    "SELECT id, username, email, role, created_at FROM users ORDER BY id DESC LIMIT 200",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ users: rows });
    }
  );
});



app.get("/api/users", requireAdmin, (req, res) => {
  db.all(
    "SELECT id, username, role, created_at FROM users ORDER BY id DESC LIMIT 200",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ users: rows });
    }
  );
});

/* ---------------- PAGES ---------------- */

app.get("/users", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  if (req.session.user.role !== "admin") return res.redirect("/");
  res.sendFile(path.join(__dirname, "public", "users.html"));
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

app.get("/contact", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "contact.html"));
});


/* ---------------- FALLBACK ROUTES ---------------- */
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/solve", (req, res) => res.sendFile(path.join(__dirname, "public", "solve.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PhysiCore running on http://localhost:${PORT}`));
