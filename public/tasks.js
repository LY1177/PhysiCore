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
function qs(sel){ return document.querySelector(sel); }

async function ensureAuth(){
  const me = await api("/api/me");
  if (!me.user) location.href = "/";
  return me.user;
}

async function loadTopics(){
  const classLevel = qs("#classSelect").value;
  const data = await api(`/api/topics?class=${classLevel}`);
  const sel = qs("#topicSelect");
  sel.innerHTML = `<option value="">Избери тема</option>` + data.topics.map(t => `<option>${t}</option>`).join("");
}

async function refreshStats(){
  const s = await api("/api/stats");
  qs("#stPoints").textContent = s.stats.totalPoints;
  qs("#stCorrect").textContent = s.stats.correctCount;
  qs("#stWrong").textContent = s.stats.wrongCount;
  qs("#stAnswered").textContent = s.stats.answeredCount;
}

function renderTasks(tasks){
  const area = qs("#taskArea");
  if (!tasks.length){
    area.innerHTML = `<div class="empty">Няма задачи за тази тема (провери seed-а).</div>`;
    return;
  }
  qs("#counter").textContent = `${tasks.length} задачи`;

  area.innerHTML = tasks.map((t, idx) => {
    const opts = t.options.map((o, oi) =>
      `<button class="opt" data-task="${t.id}" data-idx="${oi}">${String.fromCharCode(65+oi)}. ${o}</button>`
    ).join("");
    return `
      <div class="task-card" data-card="${t.id}">
        <div class="q">${idx+1}) ${t.question}</div>
        <div class="optgrid">${opts}</div>
        <div class="explain hidden" id="ex_${t.id}"></div>
      </div>
    `;
  }).join("");

  area.querySelectorAll(".opt").forEach(btn => {
    btn.addEventListener("click", async () => {
      const taskId = Number(btn.dataset.task);
      const chosenIndex = Number(btn.dataset.idx);

      // disable all options for this task while submitting
      const card = area.querySelector(`[data-card="${taskId}"]`);
      const opts = card.querySelectorAll(".opt");
      opts.forEach(o => (o.disabled = true));

      try{
        const res = await api("/api/submit","POST",{ taskId, chosenIndex });
        // mark chosen
        btn.classList.add(res.isCorrect ? "correct" : "wrong");

        const ex = qs(`#ex_${taskId}`);
        ex.classList.remove("hidden");
        ex.innerHTML = `
          <b>${res.isCorrect ? "Верен отговор ✅" : "Грешен отговор ❌"}</b>
          • Точки: <b>${res.pointsEarned}</b><br/>
          ${res.explanation}
        `;
        await refreshStats();
      }catch(err){
        const ex = qs(`#ex_${taskId}`);
        ex.classList.remove("hidden");
        ex.textContent = err.message;
        opts.forEach(o => (o.disabled = false));
      }
    });
  });
}

async function loadTasks(){
  const classLevel = qs("#classSelect").value;
  const topic = qs("#topicSelect").value;
  if (!topic) {
    qs("#taskArea").innerHTML = `<div class="empty">Моля избери тема.</div>`;
    return;
  }
  const data = await api(`/api/tasks?class=${classLevel}&topic=${encodeURIComponent(topic)}`);
  renderTasks(data.tasks);
}

async function init(){
  await ensureAuth();
  await loadTopics();
  await refreshStats();

  qs("#classSelect").addEventListener("change", async () => {
    await loadTopics();
    qs("#taskArea").innerHTML = `<div class="empty">Избери тема и зареди задачите.</div>`;
    qs("#counter").textContent = "—";
  });

  qs("#btnLoadTasks").addEventListener("click", loadTasks);
  qs("#btnReset").addEventListener("click", async () => {
    await loadTopics();
    qs("#taskArea").innerHTML = `<div class="empty">Избери тема и зареди задачите.</div>`;
    qs("#counter").textContent = "—";
  });

  qs("#btnLogout").addEventListener("click", async () => {
    await api("/api/logout","POST");
    location.href = "/";
  });
}
document.addEventListener("click", e => {
  if(!e.target.classList.contains("zoomable-img")) return;

  const overlay = document.createElement("div");
  overlay.className = "image-overlay";

  const img = document.createElement("img");
  img.src = e.target.src;

  overlay.appendChild(img);
  document.body.appendChild(overlay);

  overlay.onclick = () => overlay.remove();
});

init().catch(()=> location.href="/");
