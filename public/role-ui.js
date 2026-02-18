(async function () {
  async function logout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (_) {}
    location.href = '/';
  }

  
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

    document.querySelectorAll(".admin-only").forEach((el) => {
      el.style.display = user && user.role === "admin" ? "inline-block" : "none";
    });
  } catch (e) {
    document.querySelectorAll(".teacher-only").forEach((el) => (el.style.display = "none"));
    document.querySelectorAll(".admin-only").forEach((el) => (el.style.display = "none"));
  }
})();
