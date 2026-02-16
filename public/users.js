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

async function loadUsers() {
  const msg = document.querySelector("#msg");
  try {
    const data = await api("/api/users");
    renderTable(
      document.querySelector("#tblUsers"),
      ["ID", "Потребител", "Роля", "Създаден"],
      (data.users || []).map(u => [u.id, u.username, u.role, u.created_at])
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
    try { await api("/api/logout", "POST"); } catch (_) {}
    location.href = "/";
  });
}

initLogout();
loadUsers();
