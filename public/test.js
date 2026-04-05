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

async function ensureAuth() {
  const me = await api("/api/me");
  if (!me.user) location.href = "/";
  return me.user;
}

let currentVariants = [];
let answersVisible = false;
let onlineTestState = null;
let onlineReviewVisible = false;

function variantLabel(index, explicitLabel) {
  return explicitLabel || String.fromCharCode(1040 + index);
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
  const rightItems = right.map((label, originalIndex) => ({ label, originalIndex }));

  let seed = Number(task?.id || 1);
  for (let i = rightItems.length - 1; i > 0; i -= 1) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = seed % (i + 1);
    [rightItems[i], rightItems[j]] = [rightItems[j], rightItems[i]];
  }

  const byOriginal = new Map(rightItems.map((item, index) => [item.originalIndex, index]));
  return { left, rightItems, matches, byOriginal };
}

function renderVariants(variants) {
  const area = qs("#testArea");

  if (!variants.length) {
    area.innerHTML = `<div class="empty">Няма налични въпроси за този клас.</div>`;
    qs("#answersArea").innerHTML = "";
    return;
  }

  area.innerHTML = variants
    .map((variant, vIdx) => {
      const tasksHtml = (variant.tasks || [])
        .map((t, idx) => {
          const bodyHtml = isMatchingTask(t)
            ? (() => {
                const { left, rightItems } = getMatchingDisplay(t);
                const leftHtml = left.map((item, li) => `<div class="pill" style="width:100%; text-align:left;">${li + 1}. ${item}</div>`).join("");
                const rightHtml = rightItems.map((item, ri) => `<div class="pill" style="width:100%; text-align:left;">${answerLetter(ri)}. ${item.label}</div>`).join("");
                return `
                  <div class="row" style="gap:14px; flex-wrap:wrap; align-items:flex-start;">
                    <div style="flex:1 1 260px;"><div class="subtle" style="margin-bottom:8px;">Свържи елементите отляво с правилните отдясно.</div>${leftHtml}</div>
                    <div style="flex:1 1 260px;">${rightHtml}</div>
                  </div>
                `;
              })()
            : `<div class="optgrid">${(t.options || [])
                .map((o, oi) => `<div class="pill" style="width:100%;">${String.fromCharCode(65 + oi)}. ${o}</div>`)
                .join("")}</div>`;
          return `
            <div class="task-card">
              <div class="q">${idx + 1}) ${t.question} <span class="subtle" style="font-weight:600;">(${t.topic})</span></div>
              ${bodyHtml}
            </div>
          `;
        })
        .join("");

      return `
        <section class="panel" style="margin-bottom:18px;">
          <h2 style="margin:0 0 12px;">Вариант ${variantLabel(vIdx, variant.label)}</h2>
          ${tasksHtml || '<div class="empty">Няма въпроси за този вариант.</div>'}
        </section>
      `;
    })
    .join("");

  typesetMath(area);
  renderAnswersTable();
}

function renderAnswersTable() {
  const answersArea = qs("#answersArea");

  if (!currentVariants.length || !answersVisible) {
    answersArea.innerHTML = "";
    return;
  }

  answersArea.innerHTML = `
    <section class="panel" style="margin-top:18px; color:#000;">
      <h2 style="margin:0 0 12px; color:#fff;">Таблица с отговорите</h2>
      <p class="lead" style="margin-bottom:12px; color:#fff;">Всеки вариант е с отделен ключ за верните отговори.</p>
      <div class="row" style="gap:16px; flex-wrap:wrap; align-items:flex-start;">
        ${currentVariants
          .map((variant, vIdx) => {
            const rows = (variant.tasks || [])
              .map((task, idx) => {
                const answerText = isMatchingTask(task)
                  ? (() => {
                      const { left, matches, byOriginal } = getMatchingDisplay(task);
                      return left
                        .map((_, li) => `${li + 1}-${answerLetter(byOriginal.get(Number(matches[String(li)] ?? matches[li] ?? -1)) ?? 0)}`)
                        .join(", ");
                    })()
                  : answerLetter(task.correctIndex);
                return `
                  <tr>
                    <td style="padding:8px 10px; border:1px solid #d9d9d9; text-align:center; color:#000; background:#fff;">${idx + 1}</td>
                    <td style="padding:8px 10px; border:1px solid #d9d9d9; text-align:center; font-weight:700; color:#000; background:#fff;">${answerText}</td>
                  </tr>`;
              })
              .join("");
            return `
              <div style="flex:1 1 220px; min-width:220px; color:#000;">
                <h3 style="margin:0 0 8px; color:#fff;">Вариант ${variantLabel(vIdx, variant.label)}</h3>
                <table style="width:100%; border-collapse:collapse; background:#fff; color:#000; border-radius:12px; overflow:hidden;">
                  <thead>
                    <tr>
                      <th style="padding:8px 10px; border:1px solid #d9d9d9; background:#f5f5f5; color:#000;">№</th>
                      <th style="padding:8px 10px; border:1px solid #d9d9d9; background:#f5f5f5; color:#000;">Отговор</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
              </div>
            `;
          })
          .join("\n")}
      </div>
    </section>
  `;
}

function renderPrintTextWithMath(input) {
  const text = normalizeMathText(String(input || ""));
  const parts = [];
  const regex = /\\\((.*?)\\\)|\\\[(.*?)\\\]/gs;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(escapeHtml(text.slice(lastIndex, match.index)));
    }
    const expr = match[1] ?? match[2] ?? "";
    parts.push(`<span class="math-inline">${latexToHtml(expr)}</span>`);
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(escapeHtml(text.slice(lastIndex)));
  }

  return parts.join("");
}

function latexToHtml(input) {
  const src = String(input || "").trim();
  let i = 0;
  const greek = {
    Delta: "Δ", delta: "δ", cdot: "·", pi: "π", lambda: "λ", rho: "ρ",
    omega: "ω", Omega: "Ω", epsilon: "ε", varepsilon: "ε", Phi: "Φ", phi: "φ",
    mu: "μ", nu: "ν", theta: "θ", alpha: "α", beta: "β", gamma: "γ",
    sigma: "σ", tau: "τ", pm: "±", times: "×"
  };

  function parseExpression(stopChar) {
    let html = "";
    while (i < src.length) {
      if (stopChar && src[i] === stopChar) break;
      html += parseAtomWithScripts();
    }
    return html;
  }

  function parseAtomWithScripts() {
    let base = parseAtom();
    while (i < src.length && (src[i] === "^" || src[i] === "_")) {
      const op = src[i++];
      const body = parseGroupOrChar();
      base += op === "^" ? `<sup>${body}</sup>` : `<sub>${body}</sub>`;
    }
    return base;
  }

  function parseAtom() {
    if (i >= src.length) return "";
    const ch = src[i];

    if (ch === "{") {
      i += 1;
      const inner = parseExpression("}");
      if (src[i] === "}") i += 1;
      return inner;
    }

    if (ch === "\\") {
      i += 1;
      if (i >= src.length) return "";
      if (!/[A-Za-z]/.test(src[i])) {
        const sym = src[i++];
        return escapeHtml(sym);
      }
      let name = "";
      while (i < src.length && /[A-Za-z]/.test(src[i])) name += src[i++];
      if (name === "frac") {
        const num = parseGroupOrChar();
        const den = parseGroupOrChar();
        return `<span class="frac"><span class="num">${num}</span><span class="den">${den}</span></span>`;
      }
      if (name === "sqrt") {
        const body = parseGroupOrChar();
        return `<span class="sqrt">√<span class="sqrt-body">${body}</span></span>`;
      }
      if (name === "text") {
        return parseGroupOrChar();
      }
      if (name === "left" || name === "right") {
        return "";
      }
      if (Object.prototype.hasOwnProperty.call(greek, name)) {
        return greek[name];
      }
      return escapeHtml(name);
    }

    i += 1;
    return escapeHtml(ch);
  }

  function parseGroupOrChar() {
    if (i >= src.length) return "";
    if (src[i] === "{") {
      i += 1;
      const inner = parseExpression("}");
      if (src[i] === "}") i += 1;
      return inner;
    }
    return parseAtomWithScripts();
  }

  return parseExpression("");
}

function buildPrintHtml({ classLevel, variants }) {
  const today = new Date();
  const dateStr = today.toLocaleDateString("bg-BG");

  const variantsHtml = variants
    .map((variant, vIdx) => {
      const qHtml = (variant.tasks || [])
        .map((t, idx) => {
          const bodyHtml = isMatchingTask(t)
            ? (() => {
                const { left, rightItems } = getMatchingDisplay(t);
                const leftHtml = left.map((item, li) => `<li>${li + 1}. ${renderPrintTextWithMath(item)}</li>`).join("");
                const rightHtml = rightItems.map((item, ri) => `<li>${answerLetter(ri)}. ${renderPrintTextWithMath(item.label)}</li>`).join("");
                return `
                  <div class="row" style="gap:18px; flex-wrap:wrap; align-items:flex-start;">
                    <div style="flex:1 1 240px;"><strong>Лява колона</strong><ul class="opts">${leftHtml}</ul></div>
                    <div style="flex:1 1 240px;"><strong>Дясна колона</strong><ul class="opts">${rightHtml}</ul></div>
                  </div>
                `;
              })()
            : `<ul class="opts">${(t.options || [])
                .map((o, oi) => `<li>${String.fromCharCode(65 + oi)}. ${renderPrintTextWithMath(o)}</li>`)
                .join("")}</ul>`;
          return `
            <div class="qblock">
              <div class="qtitle">${idx + 1}. ${renderPrintTextWithMath(t.question)}</div>
              ${bodyHtml}
              <div class="meta">Тема: ${escapeHtml(String(t.topic || ""))}</div>
            </div>
          `;
        })
        .join("");

      return `
        <section class="variant-block ${vIdx > 0 ? "page-break" : ""}">
          <h1>Тест по физика • ${classLevel} клас • Вариант ${variantLabel(vIdx, variant.label)}</h1>
          <p class="sub">Дата: ${dateStr} • Име: _____________________________  Клас: _______</p>
          ${qHtml}
        </section>
      `;
    })
    .join("");

  const answerTables = variants
    .map((variant, vIdx) => {
      const rows = (variant.tasks || [])
        .map(
          (task, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${answerLetter(task.correctIndex)}</td>
            </tr>`
        )
        .join("");
      return `
        <div class="answer-card">
          <h2>Вариант ${variantLabel(vIdx, variant.label)}</h2>
          <table>
            <thead>
              <tr><th>№</th><th>Отговор</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    })
    .join("");

  return `
  <!doctype html>
  <html lang="bg">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Тест по физика • ${classLevel} клас</title>
    <style>
      *{box-sizing:border-box;font-family: ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;}
      body{margin:24px;color:#111;}
      h1{margin:0 0 6px;font-size:22px;}
      h2{margin:0 0 10px;font-size:18px;}
      .sub{color:#000000;margin:0 0 18px;font-size:13px;}
      .qblock{padding:14px 12px;border:1px solid #000000;border-radius:12px;margin:10px 0;}
      .qtitle{font-weight:800;margin-bottom:10px;}
      .opts{margin:0;padding-left:18px;}
      .opts li{margin:4px 0;}
      .meta{margin-top:10px;font-size:12px;color:#666;}
      .footer{margin-top:18px;font-size:12px;color:#666;}
      .page-break{page-break-before:always;}
      .answer-section{page-break-before:always; margin-top:8px;}
      .answer-grid{display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start;}
      .answer-card{flex:1 1 220px; min-width:220px;}
      .answer-card table{width:100%; border-collapse:collapse;}
      .answer-card th,.answer-card td{border:1px solid #000000; padding:8px 10px; text-align:center;}
      .answer-card th{background:#f5f5f5;}
      .math-inline{display:inline-block; white-space:nowrap;}
      .frac{display:inline-flex; flex-direction:column; vertical-align:middle; text-align:center; line-height:1; margin:0 .08em;}
      .frac .num{display:block; padding:0 .15em; border-bottom:1px solid currentColor;}
      .frac .den{display:block; padding:0 .15em;}
      .sqrt{display:inline-flex; align-items:flex-start;}
      .sqrt-body{display:inline-block; border-top:1px solid currentColor; padding:0 .12em; margin-left:.08em;}
      sup{font-size:.75em; vertical-align:super;}
      sub{font-size:.75em; vertical-align:sub;}
      @media print{ body{margin:12mm;} .qblock,.answer-card{break-inside:avoid;} }
    </style>
  </head>
  <body>
    ${variantsHtml}
    <section class="answer-section">
      <h1>Таблица с отговорите</h1>
      <div class="answer-grid">${answerTables}</div>
      <div class="footer">Генериран от PhysiCore</div>
    </section>
    <script>
      window.addEventListener('load', () => {
        setTimeout(() => { window.focus(); window.print(); }, 200);
      });
    <\/script>
  </body>
  </html>`;
}

function normalizeMathText(s) {
  return String(s)
    .replace(/\\\\\(/g, "\\(")
    .replace(/\\\\\)/g, "\\)")
    .replace(/\\\\\[/g, "\\[")
    .replace(/\\\\\]/g, "\\]");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetPreviewState() {
  currentVariants = [];
  answersVisible = false;
  qs("#btnPdf").disabled = true;
  qs("#btnAnswers").disabled = true;
  qs("#btnAnswers").textContent = "Покажи таблица с отговорите";
  qs("#answersArea").innerHTML = "";
}

function resetOnlineState() {
  onlineTestState = null;
  onlineReviewVisible = false;
}

async function generateTest() {
  const classLevel = qs("#testClass").value;
  const count = qs("#testCount").value;
  const variantsCount = qs("#testVariants").value;
  const hint = qs("#testHint");
  const btnPdf = qs("#btnPdf");
  const btnAnswers = qs("#btnAnswers");

  hint.textContent = "Зареждане…";
  btnPdf.disabled = true;
  btnAnswers.disabled = true;
  resetOnlineState();
  answersVisible = false;
  btnAnswers.textContent = "Покажи таблица с отговорите";
  qs("#answersArea").innerHTML = "";

  try {
    const data = await api(`/api/random-test-variants?class=${classLevel}&count=${count}&variants=${variantsCount}`);
    currentVariants = data.variants || [];
    renderVariants(currentVariants);

    const totalQuestions = currentVariants.reduce((sum, variant) => sum + (variant.tasks || []).length, 0);
    hint.textContent = `Готово: ${currentVariants.length} вариант${currentVariants.length === 1 ? "" : "а"} с общо ${totalQuestions} въпроса.` + (data.reusedTasks ? " Няма достатъчно различни задачи и част от тях са повторени между вариантите." : "");
    btnPdf.disabled = currentVariants.length === 0;
    btnAnswers.disabled = currentVariants.length === 0;
  } catch (e) {
    currentVariants = [];
    hint.textContent = e.message;
    qs("#testArea").innerHTML = `<div class="empty">${e.message}</div>`;
    qs("#answersArea").innerHTML = "";
  }
}

function toggleAnswers() {
  if (!currentVariants.length) return;
  answersVisible = !answersVisible;
  qs("#btnAnswers").textContent = answersVisible ? "Скрий таблица с отговорите" : "Покажи таблица с отговорите";
  renderAnswersTable();
}


function goToQuizMode() {
  const classLevel = qs("#testClass")?.value || "8";
  const count = qs("#testCount")?.value || "10";
  location.href = `/quiz.html?class=${encodeURIComponent(classLevel)}&count=${encodeURIComponent(count)}&autostart=1`;
}

function downloadPdf() {
  const classLevel = Number(qs("#testClass").value);
  if (!currentVariants.length) return;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Браузърът блокира прозореца. Разреши pop-up и опитай пак.");
    return;
  }
  w.document.open();
  w.document.write(buildPrintHtml({ classLevel, variants: currentVariants }));
  w.document.close();
}

function renderOnlineQuestion() {
  if (!onlineTestState) return;

  const area = qs("#testArea");
  const task = onlineTestState.tasks[onlineTestState.currentIndex];
  const selected = onlineTestState.answers[onlineTestState.currentIndex];
  const isLast = onlineTestState.currentIndex === onlineTestState.tasks.length - 1;

  let answerHtml = "";
  if (isMatchingTask(task)) {
    const matchingDisplay = onlineTestState.matchingDisplays?.[task.id] || getMatchingDisplay(task);
    onlineTestState.matchingDisplays = onlineTestState.matchingDisplays || {};
    onlineTestState.matchingDisplays[task.id] = matchingDisplay;
    const chosenMatches = selected && typeof selected === "object" ? selected : {};

    answerHtml = `
      <form id="onlineAnswerForm" style="display:grid; gap:12px;">
        ${matchingDisplay.left.map((item, idx) => `
          <div class="row" style="display:grid; grid-template-columns:minmax(0,1fr) 220px; gap:12px; align-items:center;">
            <div class="pill" style="width:100%; text-align:left;">${idx + 1}. ${item}</div>
            <select class="input online-matching-select" data-left-index="${idx}">
              <option value="">Избери съответствие</option>
              ${matchingDisplay.rightItems.map((option, optIdx) => `<option value="${optIdx}" ${String(chosenMatches[idx] ?? "") === String(optIdx) ? "selected" : ""}>${answerLetter(optIdx)}. ${option.label}</option>`).join("")}
            </select>
          </div>
        `).join("")}
      </form>
    `;
  } else {
    const optionsHtml = (task.options || [])
      .map((option, idx) => `
        <label style="display:block; margin:10px 0; padding:12px 14px; border:1px solid rgba(255,255,255,.18); border-radius:14px; background:rgba(255,255,255,.04); cursor:pointer;">
          <input type="radio" name="onlineAnswer" value="${idx}" ${selected === idx ? "checked" : ""} style="margin-right:10px;">
          <span>${String.fromCharCode(65 + idx)}. ${option}</span>
        </label>
      `)
      .join("");
    answerHtml = `<form id="onlineAnswerForm">${optionsHtml}</form>`;
  }

  const hasAnswer = () => {
    const currentAnswer = onlineTestState.answers[onlineTestState.currentIndex];
    return isMatchingTask(task)
      ? currentAnswer && typeof currentAnswer === "object" && Object.keys(currentAnswer).length === (Array.isArray(task.options?.left) ? task.options.left.length : 0) && Object.values(currentAnswer).every((value) => value !== "" && value != null)
      : currentAnswer != null;
  };

  area.innerHTML = `
    <section class="panel" style="margin-bottom:18px;">
      <div class="row" style="justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px;">
        <h2 style="margin:0;">Онлайн тест</h2>
        <div class="pill">Въпрос ${onlineTestState.currentIndex + 1} от ${onlineTestState.tasks.length}</div>
      </div>
      <div class="task-card">
        <div class="q" style="margin-bottom:10px; font-size:1.05rem;">${onlineTestState.currentIndex + 1}) ${task.question}</div>
        <div class="subtle" style="margin-bottom:12px; font-weight:600;">Тема: ${escapeHtml(String(task.topic || ""))}</div>
        ${answerHtml}
        <div class="row" style="justify-content:space-between; gap:12px; margin-top:14px; align-items:center;">
          <span class="hint">${isMatchingTask(task) ? "Избери съответствие за всеки елемент и продължи напред." : "След като продължиш напред, няма да можеш да се върнеш към този въпрос."}</span>
          <button class="btn primary" id="btnOnlineNext" ${hasAnswer() ? "" : "disabled"}>${isLast ? "Завърши теста" : "Напред"}</button>
        </div>
      </div>
    </section>
  `;

  const form = qs("#onlineAnswerForm");
  if (isMatchingTask(task)) {
    form?.addEventListener("change", () => {
      const selectedMap = {};
      form.querySelectorAll(".online-matching-select").forEach((select) => {
        const key = select.dataset.leftIndex;
        if (select.value !== "") selectedMap[key] = Number(select.value);
      });
      onlineTestState.answers[onlineTestState.currentIndex] = selectedMap;
      const expectedCount = Array.isArray(task.options?.left) ? task.options.left.length : 0;
      const nextBtn = qs("#btnOnlineNext");
      if (nextBtn) nextBtn.disabled = Object.keys(selectedMap).length !== expectedCount;
    });
  } else {
    form?.addEventListener("change", (e) => {
      const input = e.target.closest('input[name="onlineAnswer"]');
      if (!input) return;
      onlineTestState.answers[onlineTestState.currentIndex] = Number(input.value);
      const nextBtn = qs("#btnOnlineNext");
      if (nextBtn) nextBtn.disabled = false;
    });
  }

  qs("#btnOnlineNext")?.addEventListener("click", () => {
    if (!hasAnswer()) return;
    if (isLast) {
      finishOnlineTest();
      return;
    }
    onlineTestState.currentIndex += 1;
    renderOnlineQuestion();
  });

  typesetMath(area);
}

function buildReviewCard(task, idx, userAnswer) {
  if (isMatchingTask(task)) {
    const matchingDisplay = onlineTestState.matchingDisplays?.[task.id] || getMatchingDisplay(task);
    const matches = matchingDisplay.matches || {};
    const selectedMap = userAnswer && typeof userAnswer === "object" ? userAnswer : {};
    const rows = matchingDisplay.left.map((item, leftIdx) => {
      const expectedOriginal = Number(matches[String(leftIdx)] ?? matches[leftIdx]);
      const expectedShown = matchingDisplay.byOriginal.get(expectedOriginal);
      const userShown = selectedMap[leftIdx];
      const isCorrect = Number(userShown) === Number(expectedShown);
      const userLabel = userShown == null ? "—" : `${answerLetter(userShown)}. ${matchingDisplay.rightItems[userShown]?.label || ""}`;
      const correctLabel = expectedShown == null ? "—" : `${answerLetter(expectedShown)}. ${matchingDisplay.rightItems[expectedShown]?.label || ""}`;
      return `
        <li style="list-style:none; margin:8px 0; padding:10px 12px; border-radius:12px; border:1px solid ${isCorrect ? "rgba(34,197,94,.65)" : "rgba(239,68,68,.65)"}; background:${isCorrect ? "rgba(34,197,94,.18)" : "rgba(239,68,68,.18)"}; color:#fff;">
          <strong>${leftIdx + 1}. ${item}</strong><br>
          Твоят отговор: ${userLabel}<br>
          Верният отговор: ${correctLabel}
        </li>
      `;
    }).join("");

    const isCorrectQuestion = matchingDisplay.left.every((_, leftIdx) => {
      const expectedOriginal = Number(matches[String(leftIdx)] ?? matches[leftIdx]);
      return Number(selectedMap[leftIdx]) === Number(matchingDisplay.byOriginal.get(expectedOriginal));
    });

    return `
      <div class="task-card" style="margin-top:14px; border:${isCorrectQuestion ? '1px solid rgba(34,197,94,.4)' : '1px solid rgba(239,68,68,.35)'};">
        <div class="q" style="margin-bottom:6px;">${idx + 1}) ${task.question}</div>
        <div class="subtle" style="margin-bottom:10px; font-weight:600;">Тема: ${escapeHtml(String(task.topic || ""))}</div>
        <div style="margin-bottom:10px; color:${isCorrectQuestion ? '#86efac' : '#fca5a5'}; font-weight:700;">
          ${isCorrectQuestion ? 'Верен отговор' : 'Грешка в съвпаденията'}
        </div>
        <ul style="margin:0; padding:0;">${rows}</ul>
      </div>
    `;
  }

  const correctIndex = Number(task.correctIndex);
  const optionItems = (task.options || [])
    .map((option, optIdx) => {
      const isCorrect = optIdx === correctIndex;
      const isUser = optIdx === userAnswer;
      let bg = "rgba(255,255,255,.05)";
      let border = "rgba(255,255,255,.14)";
      let label = "";

      if (isCorrect) {
        bg = "rgba(34,197,94,.18)";
        border = "rgba(34,197,94,.65)";
        label = ' <strong style="color:#86efac;">(верен)</strong>';
      }
      if (isUser && !isCorrect) {
        bg = "rgba(239,68,68,.18)";
        border = "rgba(239,68,68,.65)";
        label = ' <strong style="color:#fca5a5;">(твоят отговор)</strong>';
      }

      return `<li style="list-style:none; margin:8px 0; padding:10px 12px; border-radius:12px; border:1px solid ${border}; background:${bg}; color:#fff;">${String.fromCharCode(65 + optIdx)}. ${option}${label}</li>`;
    })
    .join("");

  const isCorrectQuestion = userAnswer === correctIndex;
  const userLabel = userAnswer == null ? "Няма отговор" : answerLetter(userAnswer);

  return `
    <div class="task-card" style="margin-top:14px; border:${isCorrectQuestion ? '1px solid rgba(34,197,94,.4)' : '1px solid rgba(239,68,68,.35)'};">
      <div class="q" style="margin-bottom:6px;">${idx + 1}) ${task.question}</div>
      <div class="subtle" style="margin-bottom:10px; font-weight:600;">Тема: ${escapeHtml(String(task.topic || ""))}</div>
      <div style="margin-bottom:10px; color:${isCorrectQuestion ? '#86efac' : '#fca5a5'}; font-weight:700;">
        ${isCorrectQuestion ? 'Верен отговор' : `Грешка · твоят отговор: ${userLabel}, верният е: ${answerLetter(correctIndex)}`}
      </div>
      <ul style="margin:0; padding:0;">${optionItems}</ul>
    </div>
  `;
}

function renderOnlineReview() {
  if (!onlineTestState?.finished || !onlineReviewVisible) return "";

  const reviewHtml = onlineTestState.tasks
    .map((task, idx) => buildReviewCard(task, idx, onlineTestState.answers[idx]))
    .join("");

  return `
    <section class="panel" style="margin-top:18px;">
      <h2 style="margin:0 0 12px;">Преглед на отговорите</h2>
      <p class="lead" style="margin-bottom:12px;">Верните отговори са оцветени в зелено, а грешните ти избори – в червено.</p>
      ${reviewHtml}
    </section>
  `;
}

function finishOnlineTest() {
  if (!onlineTestState) return;

  const total = onlineTestState.tasks.length;
  let correct = 0;
  onlineTestState.tasks.forEach((task, idx) => {
    const answer = onlineTestState.answers[idx];
    if (isMatchingTask(task)) {
      const matchingDisplay = onlineTestState.matchingDisplays?.[task.id] || getMatchingDisplay(task);
      const matches = matchingDisplay.matches || {};
      const isCorrect = matchingDisplay.left.every((_, leftIdx) => {
        const expectedOriginal = Number(matches[String(leftIdx)] ?? matches[leftIdx]);
        return Number(answer?.[leftIdx]) === Number(matchingDisplay.byOriginal.get(expectedOriginal));
      });
      if (isCorrect) correct += 1;
      return;
    }
    if (Number(answer) === Number(task.correctIndex)) correct += 1;
  });

  onlineTestState.finished = true;
  onlineTestState.correctCount = correct;
  onlineTestState.percent = Math.round((correct / Math.max(1, total)) * 100);

  const area = qs("#testArea");
  area.innerHTML = `
    <section class="panel" style="margin-bottom:18px;">
      <h2 style="margin:0 0 12px;">Онлайн тестът приключи</h2>
      <div class="task-card">
        <div style="font-size:1.15rem; font-weight:800; margin-bottom:10px;">Успеваемост: ${onlineTestState.percent}%</div>
        <div class="lead" style="margin-bottom:14px;">Верни отговори: ${correct} от ${total}</div>
        <div class="row" style="gap:12px; flex-wrap:wrap;">
          <button class="btn primary" id="btnToggleReview">${onlineReviewVisible ? 'Скрий грешките си' : 'Виж грешките си'}</button>
          <button class="btn ghost" id="btnRestartOnline">Нов онлайн тест</button>
        </div>
      </div>
      ${renderOnlineReview()}
    </section>
  `;

  qs("#btnToggleReview")?.addEventListener("click", () => {
    onlineReviewVisible = !onlineReviewVisible;
    finishOnlineTest();
  });

  qs("#btnRestartOnline")?.addEventListener("click", startOnlineTest);
  typesetMath(area);
}

async function startOnlineTest() {
  const classLevel = qs("#testClass").value;
  const count = qs("#testCount").value;
  const hint = qs("#testHint");

  hint.textContent = "Зареждане на онлайн тест…";
  resetPreviewState();
  resetOnlineState();

  try {
    const data = await api(`/api/random-test?class=${classLevel}&count=${count}`);
    const tasks = data.tasks || [];

    if (!tasks.length) {
      qs("#testArea").innerHTML = `<div class="empty">Няма налични въпроси за този клас.</div>`;
      hint.textContent = "Няма налични въпроси.";
      return;
    }

    onlineTestState = {
      classLevel: Number(classLevel),
      tasks,
      currentIndex: 0,
      answers: Array(tasks.length).fill(null),
      finished: false,
      correctCount: 0,
      percent: 0,
      matchingDisplays: {},
    };

    hint.textContent = `Онлайн тестът е готов: ${tasks.length} въпроса.`;
    renderOnlineQuestion();
  } catch (e) {
    qs("#testArea").innerHTML = `<div class="empty">${e.message}</div>`;
    hint.textContent = e.message;
  }
}

async function init() {
  await ensureAuth();

  qs("#btnGenTest").addEventListener("click", generateTest);
  qs("#btnOnlineTest").addEventListener("click", startOnlineTest);
  qs("#btnQuizMode")?.addEventListener("click", goToQuizMode);
  qs("#btnPdf").addEventListener("click", downloadPdf);
  qs("#btnAnswers").addEventListener("click", toggleAnswers);
}

init().catch(() => (location.href = "/"));
