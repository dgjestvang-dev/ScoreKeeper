import { getSelectedTeam } from "./team-selection.js";
import { getSelectedPlayer } from "./player-selection.js";
import { getTeam } from "./teams.js";
import { navigateToReplacingCurrent } from "./navigation.js";
import { deletePlayer } from "./teams.js";

let nameInput;
let shirtInput;
let saveBtn;

export function initRedigerSpiller() {
    nameInput = document.getElementById("edit-player-name");
    shirtInput = document.getElementById("edit-player-shirt");
    saveBtn = document.getElementById("save-player-edit-btn");

    const teamId = getSelectedTeam();
    const playerId = getSelectedPlayer();
    const deleteBtn = document.getElementById("delete-player-btn");

    if (!teamId || !playerId) {
        document.querySelector("[data-back]")?.click();
        return;
    }

    const team = getTeam(teamId);
    const player = team.players.find(p => p.id === playerId);

    if (!player) return;

    // ✅ Fyll eksisterende data
    nameInput.value = player.name;
    shirtInput.value = player.shirt;

    saveBtn.onclick = () => {
        const newName = nameInput.value.trim();
        const newShirt = Number(shirtInput.value);

        if (!newName || !newShirt) return;

        // ✅ Oppdater spiller direkte
        player.name = newName;
        player.shirt = newShirt;

        // ✅ Viktig: persister lag
        localStorage.setItem("sk_teams", JSON.stringify(getTeamStorageDump()));

        navigateToReplacingCurrent("lag-detaljer");
    };

    
    deleteBtn.onclick = () => {
        const confirmed = confirm("Er du sikker på at du vil slette spilleren?");
        if (!confirmed) return;

        deletePlayer(teamId, playerId);

        navigateToReplacingCurrent("lag-detaljer");
    };

}
