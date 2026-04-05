const classLevelEl = document.getElementById("classLevel");
const topicSelectEl = document.getElementById("topicSelect");
const startBtnEl = document.getElementById("startBtn");
const scoreEl = document.getElementById("score");
const roundEl = document.getElementById("round");
const statusTextEl = document.getElementById("statusText");
const partsContainerEl = document.getElementById("partsContainer");

const slotBattery = document.getElementById("slot-battery");
const slotWire = document.getElementById("slot-wire");
const slotResistor = document.getElementById("slot-resistor");
const slotLamp = document.getElementById("slot-lamp");

const modal = document.getElementById("questionModal");
const questionText = document.getElementById("questionText");
const optionsBox = document.getElementById("optionsBox");
const resultText = document.getElementById("resultText");
const continueBtn = document.getElementById("continueBtn");

const REQUIRED_SEQUENCE = ["battery", "wire", "resistor", "lamp"];
const PART_LABELS = {
  battery: "Батерия",
  wire: "Проводник",
  resistor: "Резистор",
  lamp: "Лампа",
  switch: "Ключ",
  voltmeter: "Волтметър",
  ammeter: "Амперметър"
};

let score = 0;
let round = 1;
let maxRounds = 5;
let currentSequence = [];
let tasks = [];
let usedTaskIds = new Set();
let locked = false;

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

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function resetSlots() {
  slotBattery.textContent = "?";
  slotWire.textContent = "?";
  slotResistor.textContent = "?";
  slotLamp.textContent = "💡";

  slotBattery.classList.remove("filled", "correct");
  slotWire.classList.remove("filled", "correct");
  slotResistor.classList.remove("filled", "correct");
  slotLamp.classList.remove("filled", "correct", "lamp-on");
}

function getRoundParts() {
  const mustHave = ["battery", "wire", "resistor", "lamp"];
  const extra = shuffle(["switch", "voltmeter", "ammeter"]).slice(0, 2);
  return shuffle([...mustHave, ...extra]);
}

function renderParts() {
  const parts = getRoundParts();
  partsContainerEl.innerHTML = "";

  parts.forEach(part => {
    const btn = document.createElement("button");
    btn.className = "part-card";
    btn.dataset.part = part;
    btn.innerHTML = `
      <span class="part-icon">${getPartIcon(part)}</span>
      <span class="part-name">${PART_LABELS[part]}</span>
    `;

    btn.addEventListener("click", () => handlePartClick(part, btn));
    partsContainerEl.appendChild(btn);
  });
}

function getPartIcon(part) {
  switch (part) {
    case "battery": return "🔋";
    case "wire": return "🧵";
    case "resistor": return "〰️";
    case "lamp": return "💡";
    case "switch": return "⏻";
    case "voltmeter": return "V";
    case "ammeter": return "A";
    default: return "?";
  }
}

function handlePartClick(part, btn) {
  if (locked) return;

  const nextIndex = currentSequence.length;
  const expectedPart = REQUIRED_SEQUENCE[nextIndex];

  if (part !== expectedPart) {
    statusTextEl.textContent = `Грешна част. Очаква се: ${PART_LABELS[expectedPart]}`;
    btn.classList.add("wrong-flash");
    setTimeout(() => btn.classList.remove("wrong-flash"), 500);
    return;
  }

  currentSequence.push(part);
  btn.disabled = true;
  btn.classList.add("used");

  fillSlot(part);
  statusTextEl.textContent = `Добавен елемент: ${PART_LABELS[part]}`;

  if (currentSequence.length === REQUIRED_SEQUENCE.length) {
    locked = true;
    statusTextEl.textContent = "Веригата е сглобена. Отговори на въпроса.";
    openQuestionForRound();
  }
}

function fillSlot(part) {
  if (part === "battery") {
    slotBattery.textContent = "🔋";
    slotBattery.classList.add("filled");
  }
  if (part === "wire") {
    slotWire.textContent = "🧵";
    slotWire.classList.add("filled");
  }
  if (part === "resistor") {
    slotResistor.textContent = "〰️";
    slotResistor.classList.add("filled");
  }
  if (part === "lamp") {
    slotLamp.textContent = "💡";
    slotLamp.classList.add("filled");
  }
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

    tasks = shuffle(data.tasks || []);
    if (!tasks.length) {
      alert("Няма задачи за тази тема.");
      return;
    }

    score = 0;
    round = 1;
    usedTaskIds = new Set();
    scoreEl.textContent = score;
    roundEl.textContent = `${round}/${maxRounds}`;
    statusTextEl.textContent = "Започни да сглобяваш веригата.";

    prepareRound();
  } catch (err) {
    console.error(err);
    alert("Грешка при зареждане на задачите.");
  }
}

function prepareRound() {
  currentSequence = [];
  locked = false;
  resetSlots();
  renderParts();
  roundEl.textContent = `${round}/${maxRounds}`;
}

async function openQuestionForRound() {
  const task = pickRandomTask(tasks, usedTaskIds);

  if (!task) {
    statusTextEl.textContent = "Няма повече задачи в тази тема.";
    return;
  }

  usedTaskIds.add(task.id);
  modal.classList.remove("hidden");
  questionText.textContent = task.question;
  optionsBox.innerHTML = "";
  resultText.textContent = "";
  resultText.className = "";
  continueBtn.classList.add("hidden");

  task.options.forEach((option, index) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = option;

    btn.addEventListener("click", async () => {
      optionsBox.querySelectorAll("button").forEach(b => b.disabled = true);

      try {
        const result = await submitAnswer(task.id, index);

        if (result.isCorrect) {
          const gained = result.pointsEarned || task.points || 1;
          score += gained;
          scoreEl.textContent = score;

          resultText.textContent = "Верен отговор! Веригата е активирана.";
          resultText.className = "good";
          activateCircuit();

          if (round >= maxRounds) {
            continueBtn.textContent = "Финал";
          } else {
            continueBtn.textContent = "Следващ рунд";
          }
        } else {
          resultText.textContent = `Грешен отговор. ${result.explanation || ""}`;
          resultText.className = "bad";
          statusTextEl.textContent = "Неправилен отговор. Опитай нов рунд.";
        }
      } catch (err) {
        resultText.textContent = err.message;
        resultText.className = "bad";
      }

      continueBtn.classList.remove("hidden");
    });

    optionsBox.appendChild(btn);
  });
}

function activateCircuit() {
  slotBattery.classList.add("correct");
  slotWire.classList.add("correct");
  slotResistor.classList.add("correct");
  slotLamp.classList.add("correct", "lamp-on");
  statusTextEl.textContent = "Лампата светна успешно!";
}

continueBtn.addEventListener("click", () => {
  modal.classList.add("hidden");

  if (resultText.classList.contains("good")) {
    if (round >= maxRounds) {
      statusTextEl.textContent = `Браво! Завърши играта с ${score} точки.`;
      locked = true;
      partsContainerEl.innerHTML = "";
      return;
    }

    round++;
    prepareRound();
    statusTextEl.textContent = "Нов рунд. Сглоби следващата верига.";
  } else {
    prepareRound();
    statusTextEl.textContent = "Опитай пак да сглобиш веригата.";
  }
});

classLevelEl.addEventListener("change", loadTopics);
startBtnEl.addEventListener("click", startGame);

loadTopics();