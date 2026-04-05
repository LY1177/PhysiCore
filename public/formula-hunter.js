const board = document.getElementById("gameBoard");
const playerEl = document.getElementById("player");
const classLevelEl = document.getElementById("classLevel");
const topicsEl = document.getElementById("topics");
const topicsStatusEl = document.getElementById("topicsStatus");
const loadBtn = document.getElementById("loadBtn");
const scoreEl = document.getElementById("score");
const collectedEl = document.getElementById("collected");

const modal = document.getElementById("questionModal");
const topbarTitle = document.getElementById("topbarTitle");
const messageText = document.getElementById("messageText");
const questionText = document.getElementById("modalQuestionText");
const optionsBox = document.getElementById("optionsBox");
const resultText = document.getElementById("resultText");
const closeModalBtn = document.getElementById("closeModalBtn");

const GRID_SIZE = 10;
const CELL_SIZE = 56;

function shuffleArray(items) {
  const copy = Array.isArray(items) ? [...items] : [];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getMatchingState(task) {
  const left = Array.isArray(task?.options?.left) ? task.options.left : [];
  const right = Array.isArray(task?.options?.right) ? task.options.right : [];
  const matches = task?.options?.matches && typeof task.options.matches === "object" ? task.options.matches : {};
  const rightItems = shuffleArray(right.map((label, originalIndex) => ({ label, originalIndex })));
  return { left, rightItems, matches };
}


function normalizeMathText(input) {
  return String(input || "")
    .replace(/\\\\\(/g, "\(")
    .replace(/\\\\\)/g, "\)")
    .replace(/\\\\\[/g, "\[")
    .replace(/\\\\\]/g, "\]")
    .replace(/\\\(/g, "\(")
    .replace(/\\\)/g, "\)")
    .replace(/\\\[/g, "\[")
    .replace(/\\\]/g, "\]");
}

function setMathHtml(el, value) {
  if (!el) return;
  el.innerHTML = normalizeMathText(value);
}

function typesetMath(rootEl) {
  if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
    window.MathJax.typesetPromise(rootEl ? [rootEl] : undefined).catch(() => {});
  }
}

function setTopicsStatus(text, type = "") {
  if (!topicsStatusEl) return;
  topicsStatusEl.textContent = text;
  topicsStatusEl.className = `topics-status ${type}`.trim();
}

let player = { x: 0, y: 0 };
let score = 0;
let collected = 0;
let gameTasks = [];
let usedTaskIds = new Set();
let crystals = [];
let canMove = true;

async function loadTopics() {
  const classLevel = classLevelEl.value;
  topicsEl.innerHTML = "";
  topicsEl.disabled = true;
  loadBtn.disabled = true;
  setTopicsStatus("Зареждане на темите…");

  try {
    const res = await fetch(`/api/topics?class=${encodeURIComponent(classLevel)}`, { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Неуспешно зареждане на темите.");

    const topics = Array.isArray(data.topics) ? data.topics.filter(Boolean) : [];
    topicsEl.innerHTML = "";

    if (!topics.length) {
      setTopicsStatus("Няма налични теми за този клас.", "is-error");
      return;
    }

    topics.forEach((topic, index) => {
      const option = document.createElement("option");
      option.value = topic;
      option.textContent = topic;
      option.selected = index === 0;
      topicsEl.appendChild(option);
    });

    topicsEl.disabled = false;
    loadBtn.disabled = false;
    setTopicsStatus(`Заредени теми: ${topics.length}. Можеш да избереш една или повече.` , "is-success");
  } catch (err) {
    setTopicsStatus(err.message || "Грешка при темите.", "is-error");
  }
}

function selectedTopics() {
  return [...topicsEl.selectedOptions].map(o => o.value).filter(Boolean);
}

function renderPlayer() {
  playerEl.style.left = `${player.x * CELL_SIZE + 6}px`;
  playerEl.style.top = `${player.y * CELL_SIZE + 6}px`;
}

function randomFreeCell(occupied = []) {
  while (true) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    const busy = occupied.some(p => p.x === x && p.y === y) || (x === player.x && y === player.y);
    if (!busy) return { x, y };
  }
}

function renderCrystals() {
  document.querySelectorAll(".crystal").forEach(e => e.remove());

  crystals.forEach((c, index) => {
    const el = document.createElement("div");
    el.className = "crystal";
    el.dataset.index = index;
    el.style.left = `${c.x * CELL_SIZE + 12}px`;
    el.style.top = `${c.y * CELL_SIZE + 12}px`;
    board.appendChild(el);
  });
}

async function startGame() {
  const chosenTopics = selectedTopics();
  if (!chosenTopics.length) {
    setTopicsStatus("Избери поне една тема, за да стартираш играта.", "is-error");
    return;
  }

  try {
    gameTasks = await fetchTasksByClassAndTopics(classLevelEl.value, chosenTopics);
  } catch (err) {
    setTopicsStatus(err.message, "is-error");
    return;
  }

  if (!gameTasks.length) {
    setTopicsStatus("Няма задачи за избраните теми.", "is-error");
    return;
  }

  score = 0;
  collected = 0;
  usedTaskIds = new Set();
  player = { x: 0, y: 0 };
  canMove = true;

  const occupied = [];
  crystals = [];
  for (let i = 0; i < 6; i++) {
    const pos = randomFreeCell(occupied);
    occupied.push(pos);
    crystals.push(pos);
  }

  scoreEl.textContent = score;
  collectedEl.textContent = `${collected}/6`;
  topbarTitle.textContent = "Достигни зеления кръг и реши задачата в полето.";
  messageText.textContent = "";
  resultText.textContent = "";
  questionText.innerHTML = "";
  closeModalBtn.classList.add("hidden");
  setTopicsStatus(`Играта е заредена с ${gameTasks.length} задачи.`, "is-success");
  renderPlayer();
  renderCrystals();
}

function checkCrystalCollision() {
  const index = crystals.findIndex(c => c.x === player.x && c.y === player.y);
  if (index === -1) return;

  canMove = false;
  askTaskForCrystal(index);
}

async function askTaskForCrystal(crystalIndex) {
  const task = pickRandomTask(gameTasks, usedTaskIds);
  if (!task) {
    setTopicsStatus("Свършиха задачите в избраните теми.", "is-error");
    canMove = true;
    return;
  }

  usedTaskIds.add(task.id);
  modal.classList.remove("hidden");
  setMathHtml(questionText, task.question);
  resultText.textContent = "";
  resultText.className = "";
  closeModalBtn.classList.add("hidden");
  optionsBox.innerHTML = "";

  if (task.type === "matching" && task.options && !Array.isArray(task.options)) {
    const { left, rightItems } = getMatchingState(task);
    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gap = "12px";

    left.forEach((item, idx) => {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "minmax(0,1fr) 220px";
      row.style.gap = "12px";
      row.style.alignItems = "center";

      const label = document.createElement("div");
      label.className = "option-btn";
      label.style.cursor = "default";
      label.style.textAlign = "left";
      setMathHtml(label, `${idx + 1}. ${item}`);

      const select = document.createElement("select");
      select.className = "option-btn matching-select";
      select.dataset.leftIndex = String(idx);
      select.innerHTML = `<option value="">Избери съответствие</option>${rightItems
        .map((option, optIdx) => `<option value="${optIdx}">${String.fromCharCode(65 + optIdx)}. ${option.label}</option>`)
        .join("")}`;

      row.appendChild(label);
      row.appendChild(select);
      wrap.appendChild(row);
    });

    const submitBtn = document.createElement("button");
    submitBtn.className = "option-btn";
    submitBtn.textContent = "Провери съвпаденията";
    submitBtn.onclick = async () => {
      const selects = Array.from(optionsBox.querySelectorAll(".matching-select"));
      const chosenMatches = {};
      let hasEmpty = false;

      selects.forEach((sel) => {
        const leftIndex = sel.dataset.leftIndex;
        if (!sel.value) hasEmpty = true;
        const selectedRight = rightItems[Number(sel.value)];
        chosenMatches[leftIndex] = selectedRight ? selectedRight.originalIndex : "";
      });

      if (hasEmpty) {
        resultText.textContent = "Избери съответствие за всеки елемент.";
        resultText.className = "bad";
        return;
      }

      selects.forEach((sel) => (sel.disabled = true));
      submitBtn.disabled = true;

      try {
        const result = await submitAnswer(task.id, null, chosenMatches);

        if (result.isCorrect) {
          crystals.splice(crystalIndex, 1);
          renderCrystals();
          score += result.pointsEarned || task.points || 1;
          collected++;
          scoreEl.textContent = score;
          collectedEl.textContent = `${collected}/6`;
          resultText.textContent = collected === 6 ? "Браво! Събра всички формули." : "Верен отговор!";
          resultText.className = "good";
        } else {
          setMathHtml(resultText, `Грешен отговор. ${result.explanation || "Опитай следващата клетка."}`);
          resultText.className = "bad";
        }
      } catch (err) {
        resultText.textContent = err.message;
        resultText.className = "bad";
        selects.forEach((sel) => (sel.disabled = false));
        submitBtn.disabled = false;
      }

      closeModalBtn.classList.remove("hidden");
      typesetMath(modal);
    };

    wrap.appendChild(submitBtn);
    optionsBox.appendChild(wrap);
    typesetMath(modal);
    return;
  }

  task.options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    setMathHtml(btn, `<span class="option-letter">${String.fromCharCode(65 + idx)}.</span> ${opt}`);
    btn.onclick = async () => {
      optionsBox.querySelectorAll("button").forEach(b => b.disabled = true);

      try {
        const result = await submitAnswer(task.id, idx);

        if (result.isCorrect) {
          crystals.splice(crystalIndex, 1);
          renderCrystals();
          score += result.pointsEarned || task.points || 1;
          collected++;
          scoreEl.textContent = score;
          collectedEl.textContent = `${collected}/6`;
          resultText.textContent = collected === 6 ? "Браво! Събра всички формули." : "Верен отговор!";
          resultText.className = "good";
        } else {
          setMathHtml(resultText, `Грешен отговор. ${result.explanation || "Опитай следващата клетка."}`);
          resultText.className = "bad";
        }
      } catch (err) {
        resultText.textContent = err.message;
        resultText.className = "bad";
      }

      closeModalBtn.classList.remove("hidden");
      typesetMath(modal);
    };

    optionsBox.appendChild(btn);
  });

  typesetMath(modal);
}

closeModalBtn.addEventListener("click", () => {
  modal.classList.add("hidden");
  canMove = true;
});

document.addEventListener("keydown", (e) => {
  if (!canMove || !crystals.length && !gameTasks.length) return;

  if (e.key === "ArrowUp" && player.y > 0) player.y--;
  else if (e.key === "ArrowDown" && player.y < GRID_SIZE - 1) player.y++;
  else if (e.key === "ArrowLeft" && player.x > 0) player.x--;
  else if (e.key === "ArrowRight" && player.x < GRID_SIZE - 1) player.x++;
  else return;

  renderPlayer();
  checkCrystalCollision();
});

classLevelEl.addEventListener("change", async () => {
  await loadTopics();
  gameTasks = [];
  crystals = [];
  renderCrystals();
  setTopicsStatus("Избери тема и натисни „Зареди игра“.");
});

loadBtn.addEventListener("click", startGame);

loadTopics();
