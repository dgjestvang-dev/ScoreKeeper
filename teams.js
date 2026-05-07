import { loadFromStorage, saveToStorage } from "./storage.js";
import { generateId } from "./utils.js";

const STORAGE_KEY = "sk_teams";

// Structure:
// teams = {
//   [teamId]: {
//     id,
//     name,
//     players: [{ id, name, shirt }]
//   }
// }

let teams = loadFromStorage(STORAGE_KEY, {});


//MIDLERTIDIG LASTING AV LAG OG SPILLERE
if (Object.keys(teams).length === 0) {
    const friskId = createTeam("Frisk Asker");
    const guiId = createTeam("GUI");
    const askerId = createTeam("Asker SK");

    // valgfritt: testspillere
    addPlayer(friskId, { name: "Liam", shirt: 7 });
    addPlayer(friskId, { name: "Vini", shirt: 13 });
    addPlayer(guiId, { name: "Petter", shirt: 9 });
    addPlayer(askerId, { name: "Ola", shirt: 9 });
}


function persist() {
    saveToStorage(STORAGE_KEY, teams);
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export function getTeams() {
    return teams;
}

export function getTeam(teamId) {
    return teams[teamId];
}

export function createTeam(name) {
    const id = generateId();
    teams[id] = { id, name, players: [] };
    persist();
    return id;
}

export function addPlayer(teamId, player) {
    teams[teamId].players.push({
        id: generateId(),
        name: player.name,
        shirt: player.shirt
    });
    persist();
}

export function getPlayersForTeam(teamId) {
    return teams[teamId]?.players ?? [];
}

