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

function setMsg(id, text, ok=false){
  const el = qs(id);
  if (!el) return;
  el.textContent = text || "";
  el.style.color = ok ? "rgba(46,229,157,.9)" : "rgba(255,92,122,.95)";
  if (!text) el.style.color = "rgba(255,255,255,.65)";
}

async function refreshMe(){
  const me = await api("/api/me");
  const user = me.user;

  const authCard = qs("#authCard");
  const userBox = qs("#userBox");
  const paneLogin = qs("#paneLogin");
  const paneRegister = qs("#paneRegister");
  const btnLogout = qs("#btnLogout");

  if (user) {
    if (authCard) authCard.style.display = "none";
    qs("#userName").textContent = user.username;
    userBox.classList.remove("hidden");
    paneLogin.classList.add("hidden");
    paneRegister.classList.add("hidden");
    if (btnLogout) btnLogout.style.display = "inline-block";


    const s = await api("/api/stats");
    qs("#miniPoints").textContent = s.stats.totalPoints;
    qs("#miniCorrect").textContent = s.stats.correctCount;
    qs("#miniWrong").textContent = s.stats.wrongCount;
  } else {
    if (authCard) authCard.style.display = "block";
    userBox.classList.add("hidden");
    paneLogin.classList.remove("hidden");
    if (btnLogout) btnLogout.style.display = "none";
    qs("#miniPoints").textContent = "—";
    qs("#miniCorrect").textContent = "—";
    qs("#miniWrong").textContent = "—";
  }
}

function initTabs(){
  const tabs = document.querySelectorAll(".tab");
  const paneLogin = qs("#paneLogin");
  const paneRegister = qs("#paneRegister");

  tabs.forEach(t => {
    t.addEventListener("click", () => {
      tabs.forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      const tab = t.dataset.tab;
      if (tab === "login") {
        paneLogin.classList.remove("hidden");
        paneRegister.classList.add("hidden");
      } else {
    if (authCard) authCard.style.display = "block";
        paneRegister.classList.remove("hidden");
        paneLogin.classList.add("hidden");
      }
      setMsg("#loginMsg","");
      setMsg("#registerMsg","");
    });
  });
}

async function initAuth(){
  const loginForm = qs("#loginForm");
  const registerForm = qs("#registerForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(loginForm);
      try{
        await api("/api/login","POST",{
          email: fd.get("email"),
          password: fd.get("password"),
        });
        setMsg("#loginMsg","Успешен вход ✅", true);
        await refreshMe();
      }catch(err){
        setMsg("#loginMsg", err.message);
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(registerForm);
      try{
        await api("/api/register","POST",{
          username: fd.get("username"),
          email: fd.get("email"),
          password: fd.get("password"),
        });
        setMsg("#registerMsg","Регистрацията е успешна ✅", true);
        await refreshMe();
      }catch(err){
        setMsg("#registerMsg", err.message);
      }
    });
  }

  const logoutBtn2 = qs("#logoutBtn2");
  const btnLogout = qs("#btnLogout");

  async function doLogout(){
    try{
      await api("/api/logout","POST");
      location.href = "/";
    }catch(e){}
  }
  if (logoutBtn2) logoutBtn2.addEventListener("click", doLogout);
  if (btnLogout) btnLogout.addEventListener("click", doLogout);
}

initTabs();
initAuth();
refreshMe().catch(()=>{});



(function() {
  const btn = document.querySelector(".topbar .hamburger");
  const nav = document.querySelector(".topbar .nav");
  if (!btn || !nav) return;

  const setState = (open) => {
    nav.classList.toggle("open", open);
    btn.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  };

  btn.addEventListener("click", () => {
    const open = !nav.classList.contains("open");
    setState(open);
  });


  nav.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => setState(false));
  });


  document.addEventListener("click", (e) => {
    if (!nav.classList.contains("open")) return;
    if (btn.contains(e.target) || nav.contains(e.target)) return;
    setState(false);
  });

  
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) setState(false);
  });
})();
