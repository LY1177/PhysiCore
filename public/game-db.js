async function fetchTasksByClassAndTopics(classLevel, topics = []) {
  const allTasks = [];

  for (const topic of topics) {
    const res = await fetch(`/api/tasks?class=${encodeURIComponent(classLevel)}&topic=${encodeURIComponent(topic)}`, {
      credentials: "include"
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Грешка при зареждане на тема: ${topic}`);
    }

    const data = await res.json();
    if (Array.isArray(data.tasks)) {
      allTasks.push(...data.tasks);
    }
  }

  return shuffleArray(allTasks);
}

async function submitAnswer(taskId, chosenIndex) {
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ taskId, chosenIndex })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Грешка при изпращане на отговор.");
  }

  return data;
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickRandomTask(tasks, usedIds = new Set()) {
  const available = tasks.filter(t => !usedIds.has(t.id));
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}