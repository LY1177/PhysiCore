const board = document.getElementById("gameBoard");
const playerEl = document.getElementById("player");
const classLevelEl = document.getElementById("classLevel");
const topicsEl = document.getElementById("topics");
const loadBtn = document.getElementById("loadBtn");
const scoreEl = document.getElementById("score");
const collectedEl = document.getElementById("collected");

const modal = document.getElementById("questionModal");
const questionText = document.getElementById("questionText");
const optionsBox = document.getElementById("optionsBox");
const resultText = document.getElementById("resultText");
const closeModalBtn = document.getElementById("closeModalBtn");

const GRID_SIZE = 10;
const CELL_SIZE = 56;

let player = { x: 0, y: 0 };
let score = 0;
let collected = 0;
let gameTasks = [];
let usedTaskIds = new Set();
let crystals = [];
let canMove = true;

async function loadTopics() {
  const classLevel = classLevelEl.value;
  const res = await fetch(`/api/topics?class=${classLevel}`, { credentials: "include" });
  const data = await res.json();

  topicsEl.innerHTML = "";
  (data.topics || []).forEach(topic => {
    const option = document.createElement("option");
    option.value = topic;
    option.textContent = topic;
    topicsEl.appendChild(option);
  });
}

function selectedTopics() {
  return [...topicsEl.selectedOptions].map(o => o.value);
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
    alert("Избери поне една тема.");
    return;
  }

  try {
    gameTasks = await fetchTasksByClassAndTopics(classLevelEl.value, chosenTopics);
  } catch (err) {
    alert(err.message);
    return;
  }

  if (!gameTasks.length) {
    alert("Няма задачи за избраните теми.");
    return;
  }

  score = 0;
  collected = 0;
  usedTaskIds = new Set();
  player = { x: 0, y: 0 };

  const occupied = [];
  crystals = [];
  for (let i = 0; i < 6; i++) {
    const pos = randomFreeCell(occupied);
    occupied.push(pos);
    crystals.push(pos);
  }

  scoreEl.textContent = score;
  collectedEl.textContent = `${collected}/6`;
  renderPlayer();
  renderCrystals();
}

function checkCrystalCollision() {
  const index = crystals.findIndex(c => c.x === player.x && c.y === player.y);
  if (index === -1) return;

  canMove = false;
  const crystal = crystals[index];
  askTaskForCrystal(index, crystal);
}

async function askTaskForCrystal(crystalIndex) {
  const task = pickRandomTask(gameTasks, usedTaskIds);
  if (!task) {
    alert("Свършиха задачите в избраните теми.");
    canMove = true;
    return;
  }

  usedTaskIds.add(task.id);
  modal.classList.remove("hidden");
  questionText.textContent = task.question;
  resultText.textContent = "";
  closeModalBtn.classList.add("hidden");
  optionsBox.innerHTML = "";

  task.options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = opt;
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
          resultText.textContent = "Верен отговор!";
          resultText.className = "good";

          if (collected === 6) {
            resultText.textContent = "Браво! Събра всички формули.";
          }
        } else {
          resultText.textContent = `Грешен отговор. ${result.explanation || ""}`;
          resultText.className = "bad";
        }
      } catch (err) {
        resultText.textContent = err.message;
        resultText.className = "bad";
      }

      closeModalBtn.classList.remove("hidden");
    };

    optionsBox.appendChild(btn);
  });
}

closeModalBtn.addEventListener("click", () => {
  modal.classList.add("hidden");
  canMove = true;
});

document.addEventListener("keydown", (e) => {
  if (!canMove) return;

  if (e.key === "ArrowUp" && player.y > 0) player.y--;
  if (e.key === "ArrowDown" && player.y < GRID_SIZE - 1) player.y++;
  if (e.key === "ArrowLeft" && player.x > 0) player.x--;
  if (e.key === "ArrowRight" && player.x < GRID_SIZE - 1) player.x++;

  renderPlayer();
  checkCrystalCollision();
});

classLevelEl.addEventListener("change", loadTopics);
loadBtn.addEventListener("click", startGame);

loadTopics().then(startGame);