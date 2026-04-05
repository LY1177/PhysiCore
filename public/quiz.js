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

function qs(sel) {
  return document.querySelector(sel);
}

function typesetMath(rootEl) {
  if (window.MathJax && typeof MathJax.typesetPromise === "function") {
    MathJax.typesetPromise(rootEl ? [rootEl] : undefined).catch(() => {});
  }
}

function escapeHtml(s) {
  return String(s)
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

const BADGES = [
  { id: "starter", icon: "🚀", label: "Старт", hint: "Започни куиза", unlocked: (s) => s.answered >= 1 },
  { id: "precision", icon: "🎯", label: "Точен удар", hint: "Първи верен отговор", unlocked: (s) => s.correct >= 1 },
  { id: "streak2", icon: "🔥", label: "Серия", hint: "2 верни подред", unlocked: (s) => s.bestStreak >= 2 },
  { id: "half", icon: "⚡", label: "Набираш скорост", hint: "Половината въпроси са минати", unlocked: (s) => s.answered >= Math.ceil(s.total / 2) && s.total > 0 },
  { id: "smart", icon: "🧠", label: "Уверен решавач", hint: "Поне 70% успеваемост", unlocked: (s) => s.answered > 0 && s.percent >= 70 },
  { id: "master", icon: "🏆", label: "Майстор", hint: "Поне 90% успеваемост", unlocked: (s) => s.answered > 0 && s.percent >= 90 },
  { id: "legend", icon: "👑", label: "Легенда", hint: "Всички отговори са верни", unlocked: (s) => s.finished && s.correct === s.total && s.total > 0 },
];

const state = {
  tasks: [],
  currentIndex: 0,
  answers: [],
  locked: false,
  finished: false,
  justAnswered: null,
  correct: 0,
  streak: 0,
  bestStreak: 0,
};

function resetState(tasks) {
  state.tasks = tasks || [];
  state.currentIndex = 0;
  state.answers = Array(state.tasks.length).fill(null);
  state.locked = false;
  state.finished = false;
  state.justAnswered = null;
  state.correct = 0;
  state.streak = 0;
  state.bestStreak = 0;
}

function getStats() {
  const total = state.tasks.length;
  const answered = state.answers.filter((a) => a != null).length;
  const percent = answered ? Math.round((state.correct / answered) * 100) : 0;
  return {
    total,
    answered,
    correct: state.correct,
    percent,
    streak: state.streak,
    bestStreak: state.bestStreak,
    finished: state.finished,
  };
}

function answerLetter(index) {
  return String.fromCharCode(65 + Number(index || 0));
}

function shuffleArray(items) {
  const copy = Array.isArray(items) ? [...items] : [];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function isMatchingTask(task) {
  return task && task.type === "matching" && task.options && !Array.isArray(task.options);
}

function getMatchingDisplay(task) {
  const left = Array.isArray(task?.options?.left) ? task.options.left : [];
  const right = Array.isArray(task?.options?.right) ? task.options.right : [];
  const matches = task?.options?.matches && typeof task.options.matches === "object" ? task.options.matches : {};
  const rightItems = shuffleArray(right.map((label, originalIndex) => ({ label, originalIndex })));
  const byOriginal = new Map(rightItems.map((item, index) => [item.originalIndex, index]));
  return { left, rightItems, matches, byOriginal };
}

function isMatchingAnswerComplete(task, answer) {
  const expectedCount = Array.isArray(task?.options?.left) ? task.options.left.length : 0;
  return !!answer && typeof answer === "object" && Object.keys(answer).length === expectedCount;
}

function syncSidebar() {
  const stats = getStats();
  qs("#statAnswered").textContent = `${stats.answered}/${stats.total}`;
  qs("#statCorrect").textContent = String(stats.correct);
  qs("#statPercent").textContent = `${stats.percent}%`;
  qs("#statStreak").textContent = String(stats.bestStreak);
  qs("#quizStatusText").textContent = state.finished
    ? `Куизът приключи. Отключени значки: ${BADGES.filter((b) => b.unlocked(stats)).length}/${BADGES.length}.`
    : stats.total
      ? `Въпрос ${Math.min(state.currentIndex + 1, stats.total)} от ${stats.total}. След отговор ще видиш веднага дали е верен.`
      : "Избери клас и стартирай нов куиз.";
  qs("#quizProgressBar").style.width = `${stats.total ? Math.round((stats.answered / stats.total) * 100) : 0}%`;

  qs("#badgesWrap").innerHTML = BADGES.map((badge) => {
    const unlocked = badge.unlocked(stats);
    return `
      <div class="badge-chip ${unlocked ? 'unlocked' : ''}" title="${escapeHtml(badge.hint)}">
        <span>${badge.icon}</span>
        <span>${badge.label}</span>
      </div>
    `;
  }).join("");
}

function renderWelcome() {
  qs("#quizStage").innerHTML = `
    <p class="lead">Ще получаваш обратна връзка веднага след всеки отговор: зелено тикче при верен избор и червен хикс при грешка. След това продължаваш напред без връщане назад.</p>
    <div class="quiz-actions">
      <button class="btn primary" id="btnInlineStartQuiz">Старт</button>
    </div>
  `;
  qs("#btnInlineStartQuiz")?.addEventListener("click", startQuiz);
}

function renderQuestion() {
  const task = state.tasks[state.currentIndex];
  if (!task) return;

  const selected = state.answers[state.currentIndex];
  const answerState = state.justAnswered;
  const matchingTask = isMatchingTask(task);
  const matchingDisplay = matchingTask ? (state.matchingDisplays[task.id] || (state.matchingDisplays[task.id] = getMatchingDisplay(task))) : null;

  const optionsHtml = matchingTask
    ? `
      <div style="display:grid; gap:12px;">
        ${matchingDisplay.left.map((item, idx) => `
          <div class="row" style="display:grid; grid-template-columns:minmax(0,1fr) 220px; gap:12px; align-items:center;">
            <div class="quiz-option ${state.locked ? "locked dimmed" : ""}" style="cursor:default;">${idx + 1}. ${item}</div>
            <select class="input quiz-matching-select" data-left-index="${idx}" ${state.locked ? "disabled" : ""}>
              <option value="">Избери съответствие</option>
              ${matchingDisplay.rightItems.map((option, optIdx) => `<option value="${optIdx}" ${String(selected?.[idx] ?? "") === String(optIdx) ? "selected" : ""}>${answerLetter(optIdx)}. ${option.label}</option>`).join("")}
            </select>
          </div>
        `).join("")}
      </div>
    `
    : (task.options || []).map((option, idx) => {
        const isSelected = selected === idx;
        const isCorrect = Number(task.correctIndex) === idx;
        const optionClasses = ["quiz-option"];

        if (state.locked) {
          optionClasses.push("locked");
          if (isCorrect) optionClasses.push("correct");
          else if (isSelected) optionClasses.push("wrong");
          else optionClasses.push("dimmed");
        }

        return `
          <button type="button" class="${optionClasses.join(" ")}" data-answer="${idx}" ${state.locked ? "disabled" : ""}>
            <span class="quiz-option-badge">${String.fromCharCode(65 + idx)}</span>
            <span>${option}</span>
          </button>
        `;
      }).join("");

  const feedbackHtml = answerState ? `
    <div class="feedback-banner ${answerState.correct ? 'correct' : 'wrong'}">
      <div class="feedback-icon">${answerState.correct ? '✓' : '✕'}</div>
      <div>
        <div>${answerState.correct ? 'Вярно! Отличен избор!' : answerState.title}</div>
        <div style="font-weight:500; opacity:.9; margin-top:4px;">${escapeHtml(answerState.message)}</div>
      </div>
    </div>
  ` : "";

  qs("#quizMainCard")?.classList.remove("pop");
  void qs("#quizMainCard")?.offsetWidth;
  qs("#quizMainCard")?.classList.add("pop");

  qs("#quizStage").innerHTML = `
    <div class="question-kicker">🧩 Куиз въпрос ${state.currentIndex + 1}</div>
    <div class="row" style="justify-content:space-between; align-items:center; gap:12px; margin-bottom:10px;">
      <h2 style="margin:0;">${escapeHtml(String(task.topic || 'Без тема'))}</h2>
      <div class="pill">Без връщане назад</div>
    </div>
    <div class="q" style="font-size:1.1rem; margin:0 0 12px;">${state.currentIndex + 1}) ${task.question}</div>
    <div>${optionsHtml}</div>
    ${feedbackHtml}
    <div class="quiz-actions">
      <div class="floating-note">${matchingTask ? "Избери съответствие за всеки ред и после натисни „Провери“." : "Отговори, виж резултата веднага и продължи нататък."}</div>
      ${matchingTask && !state.locked ? `<button class="btn primary" id="btnSubmitMatchingQuiz" ${isMatchingAnswerComplete(task, selected) ? "" : "disabled"}>Провери</button>` : ""}
      ${state.locked ? `<button class="btn primary" id="btnNextQuestion">${state.currentIndex === state.tasks.length - 1 ? 'Виж резултата' : 'Следващ въпрос'}</button>` : ''}
    </div>
  `;

  if (matchingTask) {
    document.querySelectorAll(".quiz-matching-select").forEach((select) => {
      select.addEventListener("change", () => {
        const answer = { ...(state.answers[state.currentIndex] || {}) };
        if (select.value === "") delete answer[select.dataset.leftIndex];
        else answer[select.dataset.leftIndex] = Number(select.value);
        state.answers[state.currentIndex] = answer;
        const submitBtn = qs("#btnSubmitMatchingQuiz");
        if (submitBtn) submitBtn.disabled = !isMatchingAnswerComplete(task, answer);
      });
    });
    qs("#btnSubmitMatchingQuiz")?.addEventListener("click", () => submitAnswer(state.answers[state.currentIndex]));
  } else {
    document.querySelectorAll(".quiz-option").forEach((btn) => {
      btn.addEventListener("click", () => submitAnswer(Number(btn.dataset.answer)));
    });
  }

  qs("#btnNextQuestion")?.addEventListener("click", () => {
    if (state.currentIndex >= state.tasks.length - 1) finishQuiz();
    else {
      state.currentIndex += 1;
      state.locked = false;
      state.justAnswered = null;
      renderQuestion();
      syncSidebar();
    }
  });

  typesetMath(qs("#quizStage"));
}

function submitAnswer(answerIndex) {
  if (state.locked || state.finished) return;
  const task = state.tasks[state.currentIndex];

  let isCorrect = false;
  if (isMatchingTask(task)) {
    const matchingDisplay = state.matchingDisplays[task.id] || (state.matchingDisplays[task.id] = getMatchingDisplay(task));
    const selectedMap = answerIndex && typeof answerIndex === "object" ? answerIndex : {};
    state.answers[state.currentIndex] = selectedMap;
    isCorrect = matchingDisplay.left.every((_, leftIdx) => {
      const expectedOriginal = Number(matchingDisplay.matches[String(leftIdx)] ?? matchingDisplay.matches[leftIdx]);
      return Number(selectedMap[leftIdx]) === Number(matchingDisplay.byOriginal.get(expectedOriginal));
    });
  } else {
    isCorrect = Number(task.correctIndex) === Number(answerIndex);
    state.answers[state.currentIndex] = Number(answerIndex);
  }

  state.locked = true;
  if (isCorrect) {
    state.correct += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
  } else {
    state.streak = 0;
  }

  state.justAnswered = {
    correct: isCorrect,
    title: isMatchingTask(task) ? "Провери връзките си." : `Грешно! Верният отговор е ${answerLetter(task.correctIndex)}.`,
    message: isCorrect ? "Продължи уверено 👍" : (isMatchingTask(task) ? "Има поне едно грешно съвпадение." : "Поправи ритъма си на следващия въпрос! 🫰"),
  };

  renderQuestion();
  syncSidebar();
}

function buildResultBadgeList(stats) {
  return BADGES.filter((badge) => badge.unlocked(stats)).map((badge) => `
    <div class="badge-chip unlocked"><span>${badge.icon}</span><span>${badge.label}</span></div>
  `).join("") || '<div class="floating-note">Още няма отключени значки.</div>';
}

function buildReviewCards() {
  return state.tasks.map((task, idx) => {
    if (isMatchingTask(task)) {
      const matchingDisplay = state.matchingDisplays[task.id] || (state.matchingDisplays[task.id] = getMatchingDisplay(task));
      const userAnswer = state.answers[idx] || {};
      const rows = matchingDisplay.left.map((item, leftIdx) => {
        const expectedOriginal = Number(matchingDisplay.matches[String(leftIdx)] ?? matchingDisplay.matches[leftIdx]);
        const expectedShown = matchingDisplay.byOriginal.get(expectedOriginal);
        const userShown = userAnswer[leftIdx];
        const isCorrect = Number(userShown) === Number(expectedShown);
        return `<div class="quiz-option locked ${isCorrect ? "correct" : "wrong"}" style="margin:8px 0; display:block;">
          <strong>${leftIdx + 1}. ${item}</strong><br>
          Твоят отговор: ${userShown == null ? "—" : `${answerLetter(userShown)}. ${matchingDisplay.rightItems[userShown]?.label || ""}`}<br>
          Верният отговор: ${expectedShown == null ? "—" : `${answerLetter(expectedShown)}. ${matchingDisplay.rightItems[expectedShown]?.label || ""}`}
        </div>`;
      }).join("");
      const isQuestionCorrect = matchingDisplay.left.every((_, leftIdx) => {
        const expectedOriginal = Number(matchingDisplay.matches[String(leftIdx)] ?? matchingDisplay.matches[leftIdx]);
        return Number(userAnswer[leftIdx]) === Number(matchingDisplay.byOriginal.get(expectedOriginal));
      });
      return `
        <div class="quiz-card" style="margin-top:14px;">
          <div class="question-kicker">Въпрос ${idx + 1}</div>
          <div class="q" style="margin-bottom:8px;">${idx + 1}) ${task.question}</div>
          <div class="floating-note" style="margin-bottom:10px;">Тема: ${escapeHtml(String(task.topic || ''))}</div>
          <div style="font-weight:700; margin-bottom:8px; color:${isQuestionCorrect ? '#86efac' : '#fca5a5'};">
            ${isQuestionCorrect ? '✓ Верен отговор' : '✕ Грешни съвпадения'}
          </div>
          ${rows}
        </div>
      `;
    }

    const userAnswer = state.answers[idx];
    const correctIndex = Number(task.correctIndex);
    const optionItems = (task.options || []).map((option, optIdx) => {
      const isCorrect = optIdx === correctIndex;
      const isUser = optIdx === userAnswer;
      const classes = ["quiz-option", "locked"];
      if (isCorrect) classes.push("correct");
      else if (isUser) classes.push("wrong");
      else classes.push("dimmed");
      return `<div class="${classes.join(" ")}" style="margin:8px 0;"><span class="quiz-option-badge">${String.fromCharCode(65 + optIdx)}</span><span>${option}</span></div>`;
    }).join("");
    return `
      <div class="quiz-card" style="margin-top:14px;">
        <div class="question-kicker">Въпрос ${idx + 1}</div>
        <div class="q" style="margin-bottom:8px;">${idx + 1}) ${task.question}</div>
        <div class="floating-note" style="margin-bottom:10px;">Тема: ${escapeHtml(String(task.topic || ''))}</div>
        <div style="font-weight:700; margin-bottom:8px; color:${userAnswer === correctIndex ? '#86efac' : '#fca5a5'};">
          ${userAnswer === correctIndex ? '✓ Верен отговор' : `✕ Грешен отговор · верният е ${answerLetter(correctIndex)}`}
        </div>
        ${optionItems}
      </div>
    `;
  }).join("");
}

function finishQuiz() {
  state.finished = true;
  const stats = getStats();
  const percentDeg = Math.round((stats.correct / Math.max(1, stats.total)) * 360);
  qs("#quizStage").innerHTML = `
    <div style="text-align:center;">
      <div class="question-kicker" style="justify-content:center;">🏁 Куизът завърши</div>
      <div class="result-ring" style="--deg:${percentDeg}deg;">${stats.percent}%</div>
      <h2 style="margin:0 0 8px;">Резултат: ${stats.correct} от ${stats.total}</h2>
      <p class="lead" style="margin-bottom:14px;">Най-добра серия: ${stats.bestStreak} поредни верни отговора.</p>
      <div class="badges-wrap" style="justify-content:center; margin-bottom:16px;">${buildResultBadgeList(stats)}</div>
      <div class="quiz-actions" style="justify-content:center;">
        <button class="btn primary" id="btnShowQuizReview">Преглед на отговорите</button>
        <button class="btn ghost" id="btnRestartQuiz">Нов куиз</button>
      </div>
    </div>
    <div id="quizReviewArea"></div>
  `;

  qs("#btnShowQuizReview")?.addEventListener("click", () => {
    qs("#quizReviewArea").innerHTML = `
      <section style="margin-top:18px;">
        <h3 style="margin-bottom:8px;">Преглед</h3>
        <p class="floating-note" style="margin-bottom:10px;">Верните са маркирани в зелено, а избраните грешни – в червено.</p>
        ${buildReviewCards()}
      </section>
    `;
    typesetMath(qs("#quizReviewArea"));
    qs("#btnShowQuizReview").disabled = true;
  });

  qs("#btnRestartQuiz")?.addEventListener("click", startQuiz);
  syncSidebar();
}

async function startQuiz() {
  const classLevel = qs("#quizClass").value;
  const count = qs("#quizCount").value;
  qs("#quizStage").innerHTML = `<div class="empty">Зареждане на куиза…</div>`;

  try {
    const data = await api(`/api/random-test?class=${classLevel}&count=${count}`);
    const tasks = data.tasks || [];
    if (!tasks.length) {
      qs("#quizStage").innerHTML = `<div class="empty">Няма налични въпроси за този клас.</div>`;
      resetState([]);
      syncSidebar();
      return;
    }
    resetState(tasks);
    renderQuestion();
    syncSidebar();
  } catch (e) {
    qs("#quizStage").innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`;
  }
}

function applyQueryDefaults() {
  const params = new URLSearchParams(window.location.search);
  const classLevel = params.get("class");
  const count = params.get("count");
  if (["8", "9", "10"].includes(classLevel)) qs("#quizClass").value = classLevel;
  if (["8", "10", "12", "15", "20"].includes(count)) qs("#quizCount").value = count;
}

async function init() {
  await ensureAuth();
  applyQueryDefaults();
  qs("#btnStartQuiz").addEventListener("click", startQuiz);
  renderWelcome();
  syncSidebar();
  if (new URLSearchParams(window.location.search).get("autostart") === "1") {
    startQuiz();
  }
}

init().catch(() => (location.href = "/"));
