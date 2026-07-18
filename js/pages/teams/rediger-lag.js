import { getSelectedTeam, clearSelectedTeam } from "../../components/team-selection.js";
import { getTeam, deleteTeam, updateTeamName } from "../../core/teams.js";
import { navigateToReplacingCurrent } from "../../navigation.js";

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

    nameInput.value = team.name;

    saveBtn.onclick = async () => {
        const newName = nameInput.value.trim();
        if (!newName) {
            alert("Lagnavn kan ikke være tomt");
            return;
        }

        try {
            await updateTeamName(teamId, newName);
            navigateToReplacingCurrent("mine-lag");
        } catch (err) {
            console.error("Failed to update team", err);
            alert("Kunne ikke lagre laget");
        }
    };

    const deleteBtn = document.getElementById("delete-team-btn");

    if (deleteBtn) {
        deleteBtn.onclick = async () => {
            const team = getTeam(teamId);
            if (!team) return;

            let message = "Er du sikker på at du vil slette laget?";
            if (team.players.length > 0) {
                message += `\n\nLaget har ${team.players.length} spiller(e). Disse vil også slettes.`;
            }

            const confirmed = confirm(message);
            if (!confirmed) return;

            try {
                await deleteTeam(teamId);
                clearSelectedTeam();
                navigateToReplacingCurrent("mine-lag");
            } catch (err) {
                console.error("Failed to delete team", err);
                alert("Kunne ikke slette laget");
            }
        };
    }
}