import { createTeam } from "../../core/teams.js";
import { navigateToReplacingCurrent } from "../../navigation.js";

let teamNameInput;
let saveTeamBtn;

export function initNyttLag() {
    teamNameInput = document.getElementById("new-team-name");
    saveTeamBtn = document.getElementById("save-team-btn");

    if (!teamNameInput || !saveTeamBtn) {
        console.error("Nytt lag: DOM-elementer ikke funnet");
        return;
    }

    saveTeamBtn.onclick = (event) => {
        event.preventDefault();
        onSaveTeam();
    };
}

async function onSaveTeam() {
    const name = teamNameInput.value.trim();

    if (!name) {
        alert("Lagnavn kan ikke være tomt");
        return;
    }

    await createTeam(name);

    console.log("Lag opprettet:", name);

    teamNameInput.value = "";

    navigateToReplacingCurrent("mine-lag");
}