import { getTeam, getPlayersForTeam } from "./teams.js";
import { getSelectedTeam } from "./team-selection.js";

let teamNameHeading;
let playerListEl;

export function initLagDetaljer() {
    teamNameHeading = document.getElementById("team-name-heading");
    playerListEl = document.getElementById("player-list");

    if (!teamNameHeading || !playerListEl) {
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
        playerListEl.appendChild(li);
    });
}
