import { getTeam, getPlayersForTeam } from "../../core/teams.js";
import { getSelectedTeam } from "../../components/team-selection.js";
import { setSelectedPlayer } from "../../components/player-selection.js";

let teamNameHeading;
let teamCodeLabel;
let copyTeamCodeBtn;
let playerListEl;

export function initLagDetaljer() {
    teamNameHeading = document.getElementById("team-name-heading");
    teamCodeLabel = document.getElementById("team-code-label");
    copyTeamCodeBtn = document.getElementById("copy-team-code-btn");
    playerListEl = document.getElementById("player-list");

    if (!teamNameHeading || !teamCodeLabel || !copyTeamCodeBtn || !playerListEl) {
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
    const code = team.teamCode || "";
    teamCodeLabel.textContent = code
        ? `Lagkode: ${code}`
        : "Lagkode mangler";

    copyTeamCodeBtn.textContent = "Kopier kode";
    copyTeamCodeBtn.disabled = !code;
    copyTeamCodeBtn.onclick = async () => {
        if (!code) return;
        const copied = await copyToClipboard(code);
        copyTeamCodeBtn.textContent = copied ? "Kopiert" : "Feil";
        setTimeout(() => {
            copyTeamCodeBtn.textContent = "Kopier kode";
        }, 1400);
    };

    renderPlayerList(players);
}

async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }

        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textArea);
        return ok;
    } catch (err) {
        console.error("Failed to copy team code", err);
        return false;
    }
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
