const classLevelEl = document.getElementById("classLevel");
const topicSelectEl = document.getElementById("topicSelect");
const startBtn = document.getElementById("startBtn");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const roundEl = document.getElementById("round");

const questionTextEl = document.getElementById("questionText");
const messageTextEl = document.getElementById("messageText");

const arena = document.getElementById("arena");
const playerEl = document.getElementById("player");

const ARENA_WIDTH = 900;
const ARENA_HEIGHT = 560;
const PLAYER_WIDTH = 64;
const PLAYER_Y = 490;

let tasks = [];
let usedTaskIds = new Set();

let currentTask = null;
let fallingAnswers = [];
let bullets = [];

let score = 0;
let lives = 3;
let round = 0;

let gameRunning = false;
let animationId = null;

let playerX = ARENA_WIDTH / 2 - PLAYER_WIDTH / 2;
let movingLeft = false;
let movingRight = false;

let lastSpawnTime = 0;
let lastShotTime = 0;

async function loadTopics() {
  try {
    const res = await fetch(`/api/topics?class=${encodeURIComponent(classLevelEl.value)}`, {
      credentials: "include"
    });
    const data = await res.json();

    topicSelectEl.innerHTML = "";
    (data.topics || []).forEach(topic => {
      const option = document.createElement("option");
      option.value = topic;
      option.textContent = topic;
      topicSelectEl.appendChild(option);
    });
  } catch (err) {
    console.error(err);
  }
}

function clearArenaObjects() {
  arena.querySelectorAll(".falling-answer-v2, .bullet").forEach(el => el.remove());
  fallingAnswers = [];
  bullets = [];
}

function updatePlayer() {
  playerEl.style.left = `${playerX}px`;
  playerEl.style.top = `${PLAYER_Y}px`;
}

function createAnswerElement(answerObj) {
  const el = document.createElement("div");
  el.className = "falling-answer-v2";
  el.innerHTML = `
    <div class="answer-number">${answerObj.label}</div>
    <div class="answer-text">${answerObj.text}</div>
  `;
  el.style.left = `${answerObj.x}px`;
  el.style.top = `${answerObj.y}px`;
  arena.appendChild(el);
  answerObj.el = el;
}

function createBullet() {
  const el = document.createElement("div");
  el.className = "bullet";
  el.style.left = `${playerX + PLAYER_WIDTH / 2 - 4}px`;
  el.style.top = `${PLAYER_Y - 14}px`;
  arena.appendChild(el);

  bullets.push({
    x: playerX + PLAYER_WIDTH / 2 - 4,
    y: PLAYER_Y - 14,
    width: 8,
    height: 18,
    speed: 9,
    el
  });
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function nextRound() {
  if (!gameRunning) return;

  currentTask = pickRandomTask(tasks, usedTaskIds);

  if (!currentTask) {
    questionTextEl.textContent = `Браво! Мина всички въпроси.`;
    messageTextEl.textContent = `Краен резултат: ${score} точки.`;
    endGame();
    return;
  }

  usedTaskIds.add(currentTask.id);
  round++;
  roundEl.textContent = round;
  questionTextEl.textContent = currentTask.question;
  messageTextEl.textContent = "Уцели правилния отговор.";
  clearArenaObjects();

  const positions = [80, 280, 480, 680];
  const labels = ["A", "B", "C", "D"];

  fallingAnswers = currentTask.options.map((text, index) => ({
    text,
    originalIndex: index,
    x: positions[index],
    y: 40,
    width: 150,
    height: 72,
    speed: 1.15 + Math.random() * 0.4,
    label: labels[index],
    el: null
  }));

  fallingAnswers.forEach(createAnswerElement);
}

async function startGame() {
  const topic = topicSelectEl.value;
  if (!topic) {
    alert("Избери тема.");
    return;
  }

  try {
    const res = await fetch(`/api/tasks?class=${encodeURIComponent(classLevelEl.value)}&topic=${encodeURIComponent(topic)}`, {
      credentials: "include"
    });
    const data = await res.json();

    tasks = shuffleArray(data.tasks || []);
    if (!tasks.length) {
      alert("Няма задачи за тази тема.");
      return;
    }

    usedTaskIds = new Set();
    currentTask = null;
    score = 0;
    lives = 3;
    round = 0;
    playerX = ARENA_WIDTH / 2 - PLAYER_WIDTH / 2;

    scoreEl.textContent = score;
    livesEl.textContent = lives;
    roundEl.textContent = round;
    updatePlayer();

    gameRunning = true;
    nextRound();

    cancelAnimationFrame(animationId);
    animationLoop();
  } catch (err) {
    console.error(err);
    alert("Грешка при зареждане на задачите.");
  }
}

function endGame() {
  gameRunning = false;
  cancelAnimationFrame(animationId);
}

async function handleCorrectHit(answerObj) {
  try {
    const result = await submitAnswer(currentTask.id, answerObj.originalIndex);

    if (result.isCorrect) {
      const gained = result.pointsEarned || currentTask.points || 1;
      score += gained;
      scoreEl.textContent = score;
      messageTextEl.textContent = "Точно попадение!";
      nextRound();
    } else {
      lives--;
      livesEl.textContent = lives;
      messageTextEl.textContent = `Грешен отговор. ${result.explanation || ""}`;

      if (lives <= 0) {
        questionTextEl.textContent = "Край на играта";
        endGame();
      } else {
        nextRound();
      }
    }
  } catch (err) {
    messageTextEl.textContent = err.message;
  }
}

function animationLoop() {
  if (!gameRunning) return;

  if (movingLeft) playerX -= 6;
  if (movingRight) playerX += 6;

  if (playerX < 0) playerX = 0;
  if (playerX > ARENA_WIDTH - PLAYER_WIDTH) playerX = ARENA_WIDTH - PLAYER_WIDTH;

  updatePlayer();

  bullets.forEach(b => {
    b.y -= b.speed;
    b.el.style.top = `${b.y}px`;
    b.el.style.left = `${b.x}px`;
  });

  bullets = bullets.filter(b => {
    if (b.y < -30) {
      b.el.remove();
      return false;
    }
    return true;
  });

  fallingAnswers.forEach(ans => {
    ans.y += ans.speed;
    if (ans.el) {
      ans.el.style.top = `${ans.y}px`;
      ans.el.style.left = `${ans.x}px`;
    }
  });

  for (const ans of fallingAnswers) {
    const answerRect = {
      x: ans.x,
      y: ans.y,
      width: ans.width,
      height: ans.height
    };

    for (const bullet of bullets) {
      const bulletRect = {
        x: bullet.x,
        y: bullet.y,
        width: bullet.width,
        height: bullet.height
      };

      if (rectsOverlap(answerRect, bulletRect)) {
        bullet.el.remove();
        bullets = bullets.filter(b => b !== bullet);

        if (ans.el) ans.el.remove();
        fallingAnswers = fallingAnswers.filter(a => a !== ans);

        handleCorrectHit(ans);
        return;
      }
    }
  }

  const reachedBottom = fallingAnswers.some(ans => ans.y + ans.height >= PLAYER_Y + 20);
  if (reachedBottom) {
    lives--;
    livesEl.textContent = lives;
    messageTextEl.textContent = "Пропусна правилния момент.";

    if (lives <= 0) {
      questionTextEl.textContent = "Край на играта";
      endGame();
      return;
    }

    nextRound();
    return;
  }

  animationId = requestAnimationFrame(animationLoop);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") movingLeft = true;
  if (e.key === "ArrowRight") movingRight = true;

  if (e.code === "Space" && gameRunning) {
    const now = Date.now();
    if (now - lastShotTime > 280) {
      createBullet();
      lastShotTime = now;
    }
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") movingLeft = false;
  if (e.key === "ArrowRight") movingRight = false;
});

classLevelEl.addEventListener("change", loadTopics);
startBtn.addEventListener("click", startGame);

loadTopics();
updatePlayer();