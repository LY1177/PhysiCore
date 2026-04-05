function startGame(url) {
  document.querySelector(".games-container").style.display = "none";
  document.getElementById("gameViewer").classList.remove("hidden");

  const iframe = document.getElementById("gameFrame");
  iframe.src = url + "?class=" + getSelectedClass() + "&topic=" + getSelectedTopic();
}

function closeGame() {
  document.querySelector(".games-container").style.display = "grid";
  document.getElementById("gameViewer").classList.add("hidden");

  const iframe = document.getElementById("gameFrame");
  iframe.src = "";
}