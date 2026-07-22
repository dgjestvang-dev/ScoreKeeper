import { generateId } from "../utils.js";
import { apiUrl } from "../config/api.js";

let teams = {};

export async function rehydrateTeamsFromBackend() {
    try {
        const res = await fetch(apiUrl("/teams"));
        if (!res.ok) {
            throw new Error(`Failed to load teams (${res.status})`);
        }

        const backendTeams = await res.json();
        const hydratedTeams = {};

        for (const team of Array.isArray(backendTeams) ? backendTeams : []) {
            const teamId = team.id;
            if (!teamId) continue;

            let players = [];
            try {
                const playersRes = await fetch(apiUrl(`/teams/${teamId}/players`));
                if (playersRes.ok) {
                    const backendPlayers = await playersRes.json();
                    players = (Array.isArray(backendPlayers) ? backendPlayers : []).map((p) => ({
                        id: p.id,
                        name: p.name,
                        shirt: p.shirt_number
                    }));
                }
            } catch (err) {
                console.warn(`Failed to fetch players for team ${teamId}`, err);
            }

            hydratedTeams[teamId] = {
                id: teamId,
                name: team.name,
                players
            };
        }

        teams = hydratedTeams;
        return teams;
    } catch (err) {
        console.error("Failed to rehydrate teams from backend", err);
        return teams;
    }
}


export function getTeams() {
    return teams;
}

export function getTeam(teamId) {
    return teams[teamId];
}

export async function createTeam(name) {
    const res = await fetch(apiUrl("/teams"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ name })
    });

    const data = await res.json();
    const backendId = data.id;

    teams[backendId] = {
        id: backendId,
        name,
        players: []
    };

    return backendId;
}

export async function addPlayer(teamId, player) {
    const res = await fetch(apiUrl("/players"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            team_id: teamId,
            name: player.name,
            shirt_number: player.shirt
        })
    });

    const data = await res.json();

    if (!teams[teamId]) {
        teams[teamId] = { id: teamId, name: "", players: [] };
    }

    teams[teamId].players.push({
        id: data.id ?? generateId(),
        name: player.name,
        shirt: player.shirt
    });

}

export function getPlayersForTeam(teamId) {
    return teams[teamId]?.players ?? [];
}

export async function deletePlayer(teamId, playerId) {
    const res = await fetch(apiUrl(`/players/${playerId}`), {
        method: "DELETE"
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to delete player (${res.status})`);
    }

    const team = teams[teamId];
    if (!team) return;

    team.players = team.players.filter(p => p.id !== playerId);
}

export async function updateTeamName(teamId, newName) {
    const res = await fetch(apiUrl(`/teams/${teamId}`), {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: newName })
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to update team (${res.status})`);
    }

    const team = teams[teamId];
    if (!team) return;

    team.name = newName;
}

export async function updatePlayer(teamId, playerId, updates) {
    const res = await fetch(apiUrl(`/players/${playerId}`), {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(updates)
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to update player (${res.status})`);
    }

    const team = teams[teamId];
    if (!team) return;

    const player = team.players.find(p => p.id === playerId);
    if (!player) return;

    player.name = updates.name;
    player.shirt = updates.shirt_number;
}

export async function deleteTeam(teamId) {
    const res = await fetch(apiUrl(`/teams/${teamId}`), {
        method: "DELETE"
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to delete team (${res.status})`);
    }

    if (!teams[teamId]) return;

    delete teams[teamId];
}
