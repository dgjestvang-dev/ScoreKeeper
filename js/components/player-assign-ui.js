// ─────────────────────────────────────────────
// Player quick-assign UI
// Responsibility: show players, return playerId/null
// ─────────────────────────────────────────────

export function openPlayerAssign(players, onSelect, options = {}) {
  const sheet = document.getElementById("player-assign-sheet");
  const list = document.getElementById("player-assign-list");
  const skipBtn = document.getElementById("player-assign-skip");
  const titleEl = sheet.querySelector(".player-assign-title");

  if (!sheet || !list || !skipBtn) {
    console.warn("Player assign UI elements missing");
    return;
  }

  
  if (titleEl) {
    titleEl.textContent =
      options.title ?? "Hvordan ble målet scoret?";
  }


  // Clear previous buttons
  list.innerHTML = "";

  // Create player buttons
  players.forEach(player => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `#${player.shirt} ${player.name}`;

    btn.addEventListener("click", () => {
      closePlayerAssign();
      onSelect(player.id);
    });

    list.appendChild(btn);
  });

  // Skip button

  
  skipBtn.textContent =
    options.skipLabel ?? "Hopp over";

  skipBtn.onclick = () => {
    closePlayerAssign();
    onSelect(null);
  };

  // Show sheet
  sheet.classList.remove("hidden");
}

export function closePlayerAssign() {
  const sheet = document.getElementById("player-assign-sheet");
  if (sheet) {
    sheet.classList.add("hidden");
  }
}
