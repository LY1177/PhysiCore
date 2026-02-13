(async function () {
  async function logout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (_) {}
    location.href = '/';
  }

  // Hook logout in pages that don't have app.js
  const btnLogout = document.querySelector('#btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }

  try {
    const res = await fetch("/api/me");
    const data = await res.json().catch(() => ({}));
    const user = data.user;

    document.querySelectorAll(".teacher-only").forEach((el) => {
      el.style.display = user && user.role === "teacher" ? "inline-block" : "none";
    });
  } catch (e) {
    document.querySelectorAll(".teacher-only").forEach((el) => (el.style.display = "none"));
  }
})();
