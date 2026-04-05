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

function qs(sel) { return document.querySelector(sel); }

function typesetMath(rootEl) {
  if (window.MathJax && typeof MathJax.typesetPromise === "function") {
    MathJax.typesetPromise(rootEl ? [rootEl] : undefined).catch(() => {});
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function ensureAuth() {
  const me = await api("/api/me");
  if (!me.user) location.href = "/";
  return me.user;
}

function answerLetter(index) {
  return String.fromCharCode(65 + Number(index || 0));
}

const state = {
  tasks: [],
  currentIndex: 0,
  answers: [],
  finished: false,
  reviewVisible: false,
};

function setSelectionsFromQuery() {
  const params = new URLSearchParams(location.search);
  const classLevel = params.get('class') || '8';
  const count = params.get('count') || '10';
  if (qs('#quizClass')) qs('#quizClass').value = ['8','9','10'].includes(classLevel) ? classLevel : '8';
  if (qs('#quizCount')) qs('#quizCount').value = ['8','10','12','15','20'].includes(count) ? count : '10';
}

function renderQuestion() {
  const area = qs('#quizArea');
  const task = state.tasks[state.currentIndex];
  const selected = state.answers[state.currentIndex];
  const isLast = state.currentIndex === state.tasks.length - 1;

  const optionsHtml = (task.options || []).map((option, idx) => `
    <button class="quiz-option ${selected === idx ? 'is-selected' : ''}" data-index="${idx}" type="button">
      <span class="quiz-letter">${String.fromCharCode(65 + idx)}</span>
      <span>${option}</span>
    </button>
  `).join('');

  area.innerHTML = `
    <div class="quiz-board">
      <div class="quiz-progress">
        <div class="quiz-counter">Въпрос ${state.currentIndex + 1} от ${state.tasks.length}</div>
        <div class="pill">Без връщане назад</div>
      </div>
      <div class="quiz-topic">Тема: ${escapeHtml(task.topic || '')}</div>
      <div class="quiz-question">${state.currentIndex + 1}. ${task.question}</div>
      <div class="quiz-options">${optionsHtml}</div>
      <div class="quiz-controls">
        <div class="quiz-note">Избери отговор и продължи напред. Предишните въпроси се заключват.</div>
        <button class="btn primary" id="btnQuizNext" ${selected == null ? 'disabled' : ''}>${isLast ? 'Завърши куиза' : 'Напред'}</button>
      </div>
    </div>
  `;

  area.querySelectorAll('.quiz-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.index);
      state.answers[state.currentIndex] = idx;
      area.querySelectorAll('.quiz-option').forEach((b) => b.classList.toggle('is-selected', b === btn));
      qs('#btnQuizNext').disabled = false;
    });
  });

  qs('#btnQuizNext')?.addEventListener('click', () => {
    if (state.answers[state.currentIndex] == null) return;
    if (isLast) return finishQuiz();
    state.currentIndex += 1;
    renderQuestion();
  });

  typesetMath(area);
}

function buildReviewBlock() {
  if (!state.reviewVisible) return '';
  return `
    <div class="quiz-review">
      ${state.tasks.map((task, idx) => {
        const user = Number(state.answers[idx]);
        const correct = Number(task.correctIndex);
        const options = (task.options || []).map((option, optIdx) => {
          let cls = '';
          let suffix = '';
          if (optIdx === correct) { cls = 'correct'; suffix = ' <strong>(верен)</strong>'; }
          if (optIdx === user && user !== correct) { cls = 'wrong'; suffix = ' <strong>(твоят избор)</strong>'; }
          if (user == null && optIdx !== correct) { cls = 'missed'; }
          return `<li class="${cls}">${answerLetter(optIdx)}. ${option}${suffix}</li>`;
        }).join('');
        const ok = user === correct;
        return `
          <div class="task-card" style="border-color:${ok ? 'rgba(46,229,157,.35)' : 'rgba(255,92,122,.35)'};">
            <div class="q">${idx + 1}) ${task.question}</div>
            <div class="subtle" style="margin-bottom:10px;">Тема: ${escapeHtml(task.topic || '')}</div>
            <div style="font-weight:800; margin-bottom:10px; color:${ok ? 'var(--good)' : 'var(--bad)'};">${ok ? 'Верен отговор' : `Грешка · твоят отговор: ${user >= 0 ? answerLetter(user) : 'няма'} · верният е: ${answerLetter(correct)}`}</div>
            <ul>${options}</ul>
          </div>`;
      }).join('')}
    </div>`;
}

function finishQuiz() {
  state.finished = true;
  const total = state.tasks.length;
  let correct = 0;
  state.tasks.forEach((task, idx) => {
    if (Number(task.correctIndex) === Number(state.answers[idx])) correct += 1;
  });
  const percent = Math.round((correct / Math.max(total, 1)) * 100);
  const area = qs('#quizArea');
  area.innerHTML = `
    <div class="quiz-board" style="text-align:center;">
      <div class="quiz-result-ring" style="--pct:${percent};"></div>
      <div class="quiz-result-value">${percent}%</div>
      <h2 style="margin:12px 0 8px;">Куизът приключи</h2>
      <p class="lead" style="margin:0 auto 16px; max-width:42ch;">Верни отговори: <b>${correct}</b> от <b>${total}</b>. Резултатът се показва чак накрая, точно както поиска.</p>
      <div class="row" style="justify-content:center; gap:12px; margin-bottom:10px;">
        <button class="btn primary" id="btnToggleQuizReview">${state.reviewVisible ? 'Скрий прегледа' : 'Виж отговорите си'}</button>
        <button class="btn ghost" id="btnRestartQuiz">Нов куиз</button>
        <a class="btn ghost" href="/test">Към тестовете</a>
      </div>
      ${buildReviewBlock()}
    </div>
  `;

  qs('#btnToggleQuizReview')?.addEventListener('click', () => {
    state.reviewVisible = !state.reviewVisible;
    finishQuiz();
  });
  qs('#btnRestartQuiz')?.addEventListener('click', startQuiz);
  typesetMath(area);
}

async function startQuiz() {
  const classLevel = qs('#quizClass').value;
  const count = qs('#quizCount').value;
  const hint = qs('#quizHint');
  hint.textContent = 'Зареждане на куиза…';
  state.tasks = [];
  state.currentIndex = 0;
  state.answers = [];
  state.finished = false;
  state.reviewVisible = false;

  try {
    const data = await api(`/api/random-test?class=${encodeURIComponent(classLevel)}&count=${encodeURIComponent(count)}`);
    state.tasks = data.tasks || [];
    state.answers = Array(state.tasks.length).fill(null);
    if (!state.tasks.length) {
      qs('#quizArea').innerHTML = '<div class="empty">Няма налични въпроси за този клас.</div>';
      hint.textContent = 'Няма налични въпроси.';
      return;
    }
    hint.textContent = `Куизът е готов: ${state.tasks.length} въпроса.`;
    const url = new URL(location.href);
    url.searchParams.set('class', classLevel);
    url.searchParams.set('count', count);
    history.replaceState({}, '', url);
    renderQuestion();
  } catch (e) {
    qs('#quizArea').innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`;
    hint.textContent = e.message;
  }
}

async function init() {
  await ensureAuth();
  setSelectionsFromQuery();
  qs('#btnStartQuiz').addEventListener('click', startQuiz);
}

init().catch(() => location.href = '/');
