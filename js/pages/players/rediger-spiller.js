import { getSelectedTeam } from "../../components/team-selection.js";
import { getSelectedPlayer } from "../../components/player-selection.js";
import { getTeam, updatePlayer } from "../../core/teams.js";
import { navigateToReplacingCurrent } from "../../navigation.js";
import { deletePlayer } from "../../core/teams.js";

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
    const player = team?.players?.find(p => p.id === playerId);

    if (!player) return;

    nameInput.value = player.name;
    shirtInput.value = player.shirt;

    saveBtn.onclick = async () => {
        const newName = nameInput.value.trim();
        const newShirt = Number(shirtInput.value);

        if (!newName || !newShirt) return;

        try {
            await updatePlayer(teamId, playerId, {
                name: newName,
                shirt_number: newShirt
            });

            navigateToReplacingCurrent("lag-detaljer");
        } catch (err) {
            console.error("Failed to update player", err);
            alert("Kunne ikke lagre spilleren");
        }
    };

    deleteBtn.onclick = async () => {
        const confirmed = confirm("Er du sikker på at du vil slette spilleren?");
        if (!confirmed) return;

        try {
            await deletePlayer(teamId, playerId);
            navigateToReplacingCurrent("lag-detaljer");
        } catch (err) {
            console.error("Failed to delete player", err);
            alert("Kunne ikke slette spilleren");
        }
    };
}