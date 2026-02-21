

(() => {


  const steps = [
    {
      selector: ".brand-title",
      title: "Добре дошъл в PhysiCore",
      text: "PhysiCore е интерактивна платформа по физика за 8–10 клас. Тук решаваш задачи, получаваш обяснения и трупаш точки."
    },
    {
      selector: ".nav",
      title: "Главно меню",
      text: "Оттук може да преминеш към Задачи, Помагало, Какво научих (тест), Време за игра и Контакти."
    },
    {
      selector: "#authCard",
      title: "Вход или Регистрация",
      text: "Регистрирай се или влез в профила си, за да се запазват резултатите и точките ти."
    },
    {
      selector: ".stats-card",
      title: "Твоята статистика",
      text: "Тук може да следиш своите точки, верни и грешни отговори. Данните се обновяват в реално време."
    },
    {
      selector: "#btnStartSolve",
      title: "Започни със задачи",
      text: "Натисни тук, избери клас -> тема и започни да решаваш. След всеки отговор получаваш обяснение."
    }
  ];


  function getProfileId() {
    const nameEl = document.getElementById("userName");
    const visibleName = nameEl ? nameEl.textContent.trim() : "";

    if (visibleName && visibleName !== "—") {
      return visibleName.toLowerCase();
    }

    return "guest";
  }

  function getStorageKey() {
    return "physicore_tour_v1__" + getProfileId();
  }


  let currentStep = 0;
  let backdrop, bubble, highlighted;

  function injectStyles() {
    if (document.getElementById("pc-tour-style")) return;

    const style = document.createElement("style");
    style.id = "pc-tour-style";
    style.innerHTML = `
      .pc-tour-backdrop{
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.55);
        z-index: 9998;
      }

      .pc-tour-highlight{
        position: relative;
        z-index: 9999;
        outline: 3px solid #ffffff;
        outline-offset: 4px;
        border-radius: 10px;
      }

      .pc-tour-bubble{
        position: fixed;
        max-width: 360px;
        background: #000000;
        border-radius: 14px;
        padding: 14px;
        box-shadow: 0 15px 40px rgb(255, 255, 255);
        z-index: 9999;
        font-family: system-ui;
      }

      .pc-tour-bubble h4{
        margin: 0 0 6px;
        font-size: 15px;
      }

      .pc-tour-bubble p{
        margin: 0 0 10px;
        font-size: 13px;
        line-height: 1.4;
      }

      .pc-tour-actions{
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .pc-tour-actions button{
        border: 0;
        border-radius: 10px;
        padding: 8px 12px;
        cursor: pointer;
      }

      .pc-tour-actions .primary{
        background: #8B5CF6;
        color: #ffffff;
      }

      .pc-tour-actions .ghost{
        background: #ffffff;
      }

      .pc-tour-progress{
        font-size: 12px;
        opacity: 0.7;
        margin-bottom: 6px;
      }
    `;

    document.head.appendChild(style);
  }

  function cleanup() {
    if (highlighted) highlighted.classList.remove("pc-tour-highlight");
    highlighted = null;
    bubble?.remove();
    backdrop?.remove();
  }

  function positionBubble(element) {
    const rect = element.getBoundingClientRect();
    const padding = 12;
    const width = 360;
    const height = bubble.getBoundingClientRect().height;

    let top = rect.bottom + 12;
    let left = rect.left;

    if (top + height > window.innerHeight) {
      top = rect.top - height - 12;
    }

    if (left + width > window.innerWidth) {
      left = window.innerWidth - width - padding;
    }

    if (left < padding) left = padding;

    bubble.style.top = top + "px";
    bubble.style.left = left + "px";
  }

  function showStep() {
    cleanup();
    injectStyles();

    while (currentStep < steps.length && !document.querySelector(steps[currentStep].selector)) {
      currentStep++;
    }

    if (currentStep >= steps.length) {
      cleanup();
      return;
    }

    const step = steps[currentStep];
    const element = document.querySelector(step.selector);

    element.scrollIntoView({ behavior: "smooth", block: "center" });

    backdrop = document.createElement("div");
    backdrop.className = "pc-tour-backdrop";
    document.body.appendChild(backdrop);

    highlighted = element;
    highlighted.classList.add("pc-tour-highlight");

    bubble = document.createElement("div");
    bubble.className = "pc-tour-bubble";
    bubble.innerHTML = `
      <div class="pc-tour-progress">${currentStep + 1} / ${steps.length}</div>
      <h4>${step.title}</h4>
      <p>${step.text}</p>
      <div class="pc-tour-actions">
        <button class="ghost" id="tourSkip">Спри</button>
        ${currentStep > 0 ? '<button class="ghost" id="tourPrev">Назад</button>' : ""}
        <button class="primary" id="tourNext">${currentStep === steps.length - 1 ? "Готово" : "Напред"}</button>
      </div>
    `;

    document.body.appendChild(bubble);
    positionBubble(element);

    document.getElementById("tourSkip").onclick = cleanup;

    document.getElementById("tourNext").onclick = () => {
      if (currentStep === steps.length - 1) cleanup();
      else {
        currentStep++;
        showStep();
      }
    };

    const prevBtn = document.getElementById("tourPrev");
    if (prevBtn) {
      prevBtn.onclick = () => {
        currentStep--;
        showStep();
      };
    }

    backdrop.onclick = cleanup;
  }

  window.startPhysiCoreTour = function(force = false) {
    const key = getStorageKey();
    if (!force && localStorage.getItem(key)) return;

    currentStep = 0;

    setTimeout(() => {
      showStep();
      localStorage.setItem(key, "true");
    }, 300);
  };

  window.resetPhysiCoreTourForCurrentProfile = function() {
    localStorage.removeItem(getStorageKey());
  };

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      startPhysiCoreTour(false);
    }, 500);
  });

})();