import { createTeam } from "./teams.js";

let teamNameInput;
let saveTeamBtn;

export function initNyttLag() {
    teamNameInput = document.getElementById("new-team-name");
    saveTeamBtn = document.getElementById("save-team-btn");

    if (!teamNameInput || !saveTeamBtn) {
        console.error("Nytt lag: DOM‑elementer ikke funnet");
        return;
    }

    saveTeamBtn.addEventListener("click", onSaveTeam);
}

function onSaveTeam() {
    const name = teamNameInput.value.trim();

    if (!name) {
        alert("Lagnavn kan ikke være tomt");
        return;
    }

    createTeam(name);

    console.log("Lag opprettet:", name);

    teamNameInput.value = "";

    // Navigasjon tilbake til Mine lag
    // Hvis du bruker data-nav: bare gå tilbake
    document.querySelector('[data-nav="mine-lag"]')?.click();
}