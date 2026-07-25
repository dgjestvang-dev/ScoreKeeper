import { getTeam, getPlayersForTeam } from "../../core/teams.js";
import { getSelectedTeam } from "../../components/team-selection.js";
import { setSelectedPlayer } from "../../components/player-selection.js";

let teamNameHeading;
let teamCodeLabel;
let playerListEl;

export function initLagDetaljer() {
    teamNameHeading = document.getElementById("team-name-heading");
    teamCodeLabel = document.getElementById("team-code-label");
    playerListEl = document.getElementById("player-list");

    if (!teamNameHeading || !teamCodeLabel || !playerListEl) {
        console.error("Lagdetaljer: DOM-elementer ikke funnet");
        return;
    }

    const teamId = getSelectedTeam();
    if (!teamId) {
        console.warn("Ingen valgt lag – går tilbake");
        document.querySelector('[data-back]')?.click();
        return;
    }

    const team = getTeam(teamId);
    const players = getPlayersForTeam(teamId);

    teamNameHeading.textContent = team.name;
    teamCodeLabel.textContent = team.teamCode
        ? `Lagkode ${team.teamCode}`
        : "Lagkode mangler";
    renderPlayerList(players);
}

function renderPlayerList(players) {
    playerListEl.innerHTML = "";

    if (players.length === 0) {
        const li = document.createElement("li");
        li.textContent = "Ingen spillere i laget enda";
        li.className = "empty";
        playerListEl.appendChild(li);
        return;
    }

    
players.forEach(player => {
    const li = document.createElement("li");
    li.className = "player-item";
    li.textContent = `#${player.shirt} ${player.name}`;

    li.dataset.nav = "rediger-spiller";
    li.addEventListener("click", () => {
        setSelectedPlayer(player.id);
    });

    playerListEl.appendChild(li);
});

}
