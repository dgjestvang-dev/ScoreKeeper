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

// ─────────────────────────────────────────────
// SLETT SPILLERE/LAG | OPPDATERE LAG
// ─────────────────────────────────────────────


export function deletePlayer(teamId, playerId) {
    const team = teams[teamId];
    if (!team) return;

    team.players = team.players.filter(p => p.id !== playerId);
    persist();
}

export function updateTeamName(teamId, newName) {
    const team = teams[teamId];
    if (!team) return;

    team.name = newName;
    persist();
}


export function deleteTeam(teamId) {
 console.warn("deleteTeam: team not found", teamId);    if (!teams[teamId]) {
        return;
    }

    delete teams[teamId];
    persist();
}

