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

function typesetMath(rootEl){
  if (window.MathJax && typeof MathJax.typesetPromise === 'function') {
    MathJax.typesetPromise(rootEl ? [rootEl] : undefined).catch(() => {});
  }
}

async function ensureAuth() {
  const me = await api("/api/me");
  if (!me.user) location.href = "/";
  return me.user;
}

let currentTest = [];

function renderTest(tasks) {
  const area = qs("#testArea");

  if (!tasks.length) {
    area.innerHTML = `<div class="empty">Няма налични въпроси за този клас.</div>`;
    return;
  }

  area.innerHTML = tasks
    .map((t, idx) => {
      const opts = (t.options || [])
        .map((o, oi) => `<div class="pill" style="width:100%;">${String.fromCharCode(65 + oi)}. ${o}</div>`)
        .join("");
      return `
        <div class="task-card">
          <div class="q">${idx + 1}) ${t.question} <span class="subtle" style="font-weight:600;">(${t.topic})</span></div>
          <div class="optgrid">${opts}</div>
        </div>
      `;
    })
    .join("");


  typesetMath(area);
}

function buildPrintHtml({ classLevel, tasks }) {
  const today = new Date();
  const dateStr = today.toLocaleDateString("bg-BG");

  const qHtml = tasks
    .map((t, idx) => {
      const opts = (t.options || [])
        .map((o, oi) => `<li>${String.fromCharCode(65 + oi)}. ${escapeHtml(String(o))}</li>`)
        .join("");
      return `
        <div class="qblock">
          <div class="qtitle">${idx + 1}. ${escapeHtml(String(t.question))}</div>
          <ul class="opts">${opts}</ul>
          <div class="meta">Тема: ${escapeHtml(String(t.topic || ""))}</div>
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
    <script>
      window.MathJax = {
        tex: { inlineMath: [['\\(','\\)']], displayMath: [['\\[','\\]']] },
        options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] }
      };
    </script>
    <script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    <style>
      *{box-sizing:border-box;font-family: ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;}
      body{margin:24px;color:#111;}
      h1{margin:0 0 6px;font-size:22px;}
      .sub{color:#444;margin:0 0 18px;font-size:13px;}
      .qblock{padding:14px 12px;border:1px solid #ddd;border-radius:12px;margin:10px 0;}
      .qtitle{font-weight:800;margin-bottom:10px;}
      .opts{margin:0;padding-left:18px;}
      .opts li{margin:4px 0;}
      .meta{margin-top:10px;font-size:12px;color:#666;}
      .footer{margin-top:18px;font-size:12px;color:#666;}
      @media print{ body{margin:12mm;} .qblock{break-inside:avoid;} }
    </style>
  </head>
  <body>
    <h1>Тест по физика • ${classLevel} клас</h1>
    <p class="sub">Дата: ${dateStr} • Име: _____________________________  Клас: _______</p>
    ${qHtml}
    <div class="footer">Генериран от PhysiCore</div>
    <script>
      window.onload = () => {
        if (window.MathJax && typeof MathJax.typesetPromise === 'function') {
          MathJax.typesetPromise().then(() => window.print()).catch(() => window.print());
        } else {
          window.print();
        }
      };
    </script>
  </body>
  </html>`;
}

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function generateTest() {
  const classLevel = qs("#testClass").value;
  const count = qs("#testCount").value;
  const hint = qs("#testHint");
  const btnPdf = qs("#btnPdf");

  hint.textContent = "Зареждане…";
  btnPdf.disabled = true;

  try {
    const data = await api(`/api/random-test?class=${classLevel}&count=${count}`);
    currentTest = data.tasks || [];
    renderTest(currentTest);
    hint.textContent = `Готово: ${currentTest.length} въпроса.`;
    btnPdf.disabled = currentTest.length === 0;
  } catch (e) {
    hint.textContent = e.message;
    qs("#testArea").innerHTML = `<div class="empty">${e.message}</div>`;
  }
}

function downloadPdf() {
  const classLevel = Number(qs("#testClass").value);
  if (!currentTest.length) return;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Браузърът блокира прозореца. Разреши pop-up и опитай пак.");
    return;
  }
  w.document.open();
  w.document.write(buildPrintHtml({ classLevel, tasks: currentTest }));
  w.document.close();
}

async function init() {
  await ensureAuth();


  qs("#btnGenTest").addEventListener("click", generateTest);
  qs("#btnPdf").addEventListener("click", downloadPdf);
}

init().catch(() => (location.href = "/"));
