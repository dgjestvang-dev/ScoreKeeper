import { getSelectedTeam, clearSelectedTeam } from "./team-selection.js";
import { getTeam, deleteTeam, updateTeamName } from "./teams.js";
import { navigateToReplacingCurrent } from "./navigation.js";

let nameInput;
let saveBtn;

export function initRedigerLag() {
    nameInput = document.getElementById("edit-team-name");
    saveBtn = document.getElementById("save-team-edit-btn");

    const teamId = getSelectedTeam();
    if (!teamId) {
        navigateToReplacingCurrent("mine-lag");
        return;
    }

    const team = getTeam(teamId);
    if (!team) {
        navigateToReplacingCurrent("mine-lag");
        return;
    }

    // ✅ Forhåndsfyll eksisterende navn
    nameInput.value = team.name;

    saveBtn.onclick = () => {
        const newName = nameInput.value.trim();
        if (!newName) {
            alert("Lagnavn kan ikke være tomt");
            return;
        }

        updateTeamName(teamId, newName);

        navigateToReplacingCurrent("mine-lag");
    };

    
    const deleteBtn = document.getElementById("delete-team-btn");

    if (deleteBtn) {
        deleteBtn.onclick = () => {
            const team = getTeam(teamId);
            if (!team) return;

            let message = "Er du sikker på at du vil slette laget?";
            if (team.players.length > 0) {
                message += `\n\nLaget har ${team.players.length} spiller(e). Disse vil også slettes.`;
            }

            const confirmed = confirm(message);
            if (!confirmed) return;

            deleteTeam(teamId);
            clearSelectedTeam();

            navigateToReplacingCurrent("mine-lag");
        };
    }

}
