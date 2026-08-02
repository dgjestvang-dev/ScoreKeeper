import { getTeam, getPlayersForTeam } from "../../core/teams.js";
import { getSelectedTeam } from "../../components/team-selection.js";
import { setSelectedPlayer } from "../../components/player-selection.js";
import { apiUrl } from "../../config/api.js";

let teamNameHeading;
let teamCodeLabel;
let copyTeamCodeBtn;
let playerListEl;

export async function initLagDetaljer() {
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

    const playerStats = await loadPlayerStatsForTeam(teamId, players);
    renderPlayerTable(players, playerStats);
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

function renderPlayerTable(players, statsByPlayerId) {
    playerListEl.innerHTML = "";

    if (players.length === 0) {
        const empty = document.createElement("div");
        empty.textContent = "Ingen spillere i laget enda";
        empty.className = "empty";
        playerListEl.appendChild(empty);
        return;
    }

    const table = document.createElement("table");
    table.className = "player-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Spiller</th>
            <th>K</th>
            <th>m</th>
            <th>a</th>
            <th>gk</th>
            <th>rk</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    players.forEach(player => {
        const row = document.createElement("tr");
        row.className = "player-row";
        row.dataset.nav = "rediger-spiller";

        const key = String(player.id);
        const stats = statsByPlayerId.get(key) ?? {
            matches: 0,
            goals: 0,
            assists: 0,
            yellowCard: 0,
            redCard: 0
        };

        const playerCell = document.createElement("td");
        playerCell.className = "player-cell-name";
        playerCell.textContent = `#${player.shirt} ${player.name}`;

        row.appendChild(playerCell);
        row.appendChild(createStatCell(stats.matches));
        row.appendChild(createStatCell(stats.goals));
        row.appendChild(createStatCell(stats.assists));
        row.appendChild(createStatCell(stats.yellowCard));
        row.appendChild(createStatCell(stats.redCard));

        row.addEventListener("click", () => {
            setSelectedPlayer(player.id);
        });

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    playerListEl.appendChild(table);
}

function createStatCell(value) {
    const cell = document.createElement("td");
    cell.className = "player-cell-stat";
    cell.textContent = String(value ?? 0);
    return cell;
}

async function loadPlayerStatsForTeam(teamId, players) {
    const defaultStats = new Map(
        (players || []).map(player => [
            String(player.id),
            { matches: 0, goals: 0, assists: 0, yellowCard: 0, redCard: 0 }
        ])
    );
    const playerMatchIds = new Map(
        (players || []).map(player => [String(player.id), new Set()])
    );

    try {
        const [matchesRes, eventsRes] = await Promise.all([
            fetch(apiUrl("/matches")),
            fetch(apiUrl("/events"))
        ]);

        if (!matchesRes.ok || !eventsRes.ok) {
            throw new Error(`Stats fetch failed (${matchesRes.status}/${eventsRes.status})`);
        }

        const [matches, events] = await Promise.all([
            matchesRes.json(),
            eventsRes.json()
        ]);

        const targetTeamId = Number(teamId);
        const relevantMatchIds = new Set(
            (Array.isArray(matches) ? matches : [])
                .filter(match =>
                    Number(match.home_team_id) === targetTeamId ||
                    Number(match.away_team_id) === targetTeamId
                )
                .map(match => Number(match.id))
        );

        for (const event of Array.isArray(events) ? events : []) {
            const matchId = Number(event.match_id);
            if (!relevantMatchIds.has(matchId)) continue;

            const playerId = event.player_id;
            if (playerId === null || playerId === undefined) continue;

            const key = String(playerId);
            const current = defaultStats.get(key);
            if (!current) continue;
            playerMatchIds.get(key)?.add(matchId);

            if (event.type === "goals") {
                current.goals += 1;
            } else if (event.type === "assists") {
                current.assists += 1;
            } else if (event.type === "yellow_card") {
                current.yellowCard += 1;
            } else if (event.type === "red_card") {
                current.redCard += 1;
            }
        }

        for (const [key, matchIds] of playerMatchIds.entries()) {
            const current = defaultStats.get(key);
            if (!current) continue;
            current.matches = matchIds.size;
        }

        return defaultStats;
    } catch (error) {
        console.error("Kunne ikke hente spillerstatistikk", error);
        return defaultStats;
    }
}
