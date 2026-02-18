async function api(path, method = "GET", body) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Грешка");
  return data;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function renderTable(el, headers, rows) {
  const thead = `<thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  el.innerHTML = thead + tbody;
}

async function loadTeacher() {
  const msg = document.querySelector("#teacherMsg");
  try {
    const [overview, lb] = await Promise.all([
      api("/api/teacher/overview"),
      api("/api/teacher/leaderboard"),
    ]);

    const topTbl = document.querySelector("#tblTopWrong");
    renderTable(
      topTbl,
      ["Тема", "Опити", "Грешни"],
      (overview.topWrongTopics || []).map(r => [r.topic, r.attempts, r.wrongs])
    );

    const lbTbl = document.querySelector("#tblLeaderboard");
    renderTable(
      lbTbl,
      ["Потребител", "Точки", "Верни", "Грешни"],
      (lb.leaderboard || []).map(r => [r.username, r.points, r.correct, r.wrong])
    );

    if (msg) msg.textContent = "✅ Заредено.";
  } catch (e) {
    if (msg) msg.textContent = `❌ Няма достъп или грешка: ${e.message}`;
  }
}

async function initLogout() {
  const btn = document.querySelector("#btnLogout");
  if (!btn) return;
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await api("/api/logout", "POST");
    } catch (e2) {}
    location.href = "/";
  });
}

initLogout();
loadTeacher();


const btnLogout = document.querySelector('#btnLogout');
if (btnLogout) {
  btnLogout.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await api('/api/logout', 'POST'); } catch (_) {}
    location.href = '/';
  });
}
