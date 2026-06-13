import { addPlayer } from "../../core/teams.js";
import { getSelectedTeam } from "../../components/team-selection.js";
import { navigateToReplacingCurrent } from "../../navigation.js";

let nameInput;
let shirtInput;
let saveBtn;

export function initNySpiller() {
    nameInput = document.getElementById("player-name");
    shirtInput = document.getElementById("player-shirt");
    saveBtn = document.getElementById("save-player-btn");

    if (!nameInput || !shirtInput || !saveBtn) {
        console.error("Ny spiller: DOM-elementer ikke funnet");
        return;
    }

    // Viktig: fjern gamle lyttere hvis view besøkes flere ganger
    saveBtn.onclick = onSavePlayer;
}

function onSavePlayer() {
    const teamId = getSelectedTeam();
    if (!teamId) {
        alert("Ingen lag valgt");
        return;
    }

    const name = nameInput.value.trim();
    const shirt = Number(shirtInput.value);

    if (!name) {
        alert("Spillernavn mangler");
        return;
    }

    if (!shirt || shirt < 1 || shirt > 99) {
        alert("Ugyldig draktnummer");
        return;
    }

    // ✅ 1. LAGRE DATA
    addPlayer(teamId, { name, shirt });

    // ✅ 2. RYDD INPUT
    nameInput.value = "";
    shirtInput.value = "";

    // ✅ 3. NAVIGER "DONE" (IKKE push til historikk)
    navigateToReplacingCurrent("lag-detaljer");
}
