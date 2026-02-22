document.querySelectorAll(".handbook-card .toggle").forEach(btn => {
  btn.addEventListener("click", () => {
    const card = btn.closest(".handbook-card");
    const content = card.querySelector(".handbook-content");

    content.classList.toggle("hidden");
    btn.textContent = content.classList.contains("hidden") ? "Покажи" : "Скрий";
  });
});

document.addEventListener("click", e => {
  if (!e.target.classList.contains("zoomable")) return;

  const overlay = document.createElement("div");
  overlay.className = "image-overlay";

  const img = document.createElement("img");
  img.src = e.target.src;

  overlay.appendChild(img);
  document.body.appendChild(overlay);

  overlay.onclick = () => overlay.remove();
});