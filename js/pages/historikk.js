import { navigateTo } from "../navigation.js";
import { apiUrl } from "../config/api.js";

function toPlayerLabel(playerId, playersById) {
    if (!playerId) return "(Ukjent spiller)";

    const player = playersById.get(Number(playerId)) || playersById.get(playerId);
    if (!player) return "(Ikke angitt spiller)";

    return `#${player.shirt_number ?? "?"} ${player.name}`;
}

function formatGoals(events, playersById) {
    const goals = events
        .filter(e => e.type === "goals")
        .sort((a, b) => {
            if ((a.half ?? 0) !== (b.half ?? 0)) return (a.half ?? 0) - (b.half ?? 0);
            if ((a.minute ?? 0) !== (b.minute ?? 0)) return (a.minute ?? 0) - (b.minute ?? 0);
            return (a.timestamp ?? 0) - (b.timestamp ?? 0);
        });

    if (goals.length === 0) return ["Ingen mål"];

    let homeGoals = 0;
    let awayGoals = 0;
    let currentHalf = goals[0].half;
    const lines = [];

    for (const goal of goals) {
        if (goal.half !== currentHalf) {
            lines.push("-------- Pause --------");
            currentHalf = goal.half;
        }

        if (goal.team === "home") {
            homeGoals++;
        } else {
            awayGoals++;
        }

        const assist = events.find(e =>
            e.type === "assists" &&
            e.team === goal.team &&
            e.half === goal.half &&
            e.minute === goal.minute &&
            e.timestamp === goal.timestamp
        );

        const minuteText = `${goal.minute}'`;
        const scoreText = `${homeGoals}–${awayGoals}`;
        const playerText = toPlayerLabel(goal.player_id, playersById);
        const assistText = assist ? ` (${toPlayerLabel(assist.player_id, playersById)})` : "";

        lines.push(`${minuteText}   ${scoreText}   ${playerText}${assistText}`);
    }

    return lines;
}

function formatCards(events, playersById) {
    const cards = events
        .filter(e => e.type === "yellow_card" || e.type === "red_card")
        .sort((a, b) => {
            if ((a.half ?? 0) !== (b.half ?? 0)) return (a.half ?? 0) - (b.half ?? 0);
            if ((a.minute ?? 0) !== (b.minute ?? 0)) return (a.minute ?? 0) - (b.minute ?? 0);
            return (a.timestamp ?? 0) - (b.timestamp ?? 0);
        });

    if (cards.length === 0) return ["Ingen kort"];

    return cards.map(card => {
        const symbol = card.type === "red_card" ? "🟥" : "🟨";
        return `${card.minute}'   ${symbol}   ${toPlayerLabel(card.player_id, playersById)}`;
    });
}

function count(events, type, team, half = null) {
    return events.filter(e =>
        e.type === type &&
        e.team === team &&
        (half === null || e.half === half)
    ).length;
}

function formatStatLine(events, label, type) {
    const homeFull = count(events, type, "home");
    const awayFull = count(events, type, "away");
    const homeHT = count(events, type, "home", 1);
    const awayHT = count(events, type, "away", 1);

    return `${label}: ${homeFull} – ${awayFull} (HT: ${homeHT} – ${awayHT})`;
}

function buildSnapshotFromBackend(match, allEventsForMatch, playersById) {
    const homeFT = count(allEventsForMatch, "goals", "home");
    const awayFT = count(allEventsForMatch, "goals", "away");
    const homeHT = count(allEventsForMatch, "goals", "home", 1);
    const awayHT = count(allEventsForMatch, "goals", "away", 1);

    return {
        header: `${match.home_team_name} - ${match.away_team_name}: ${homeFT} – ${awayFT}  (HT: ${homeHT} – ${awayHT})`,
        events: formatGoals(allEventsForMatch, playersById),
        cards: formatCards(allEventsForMatch, playersById),
        stats: [
            formatStatLine(allEventsForMatch, "Avslutninger", "shots_total"),
            formatStatLine(allEventsForMatch, "Skudd på mål", "shots_target"),
            formatStatLine(allEventsForMatch, "Corner", "corners"),
            formatStatLine(allEventsForMatch, "Offside", "offside"),
            formatStatLine(allEventsForMatch, "Gult kort", "yellow_card"),
            formatStatLine(allEventsForMatch, "Rødt kort", "red_card")
        ]
    };
}

async function loadHistoryFromBackend() {
    const [matchesRes, eventsRes, playersRes] = await Promise.all([
        fetch(apiUrl("/matches")),
        fetch(apiUrl("/events")),
        fetch(apiUrl("/players"))
    ]);

    if (!matchesRes.ok || !eventsRes.ok) {
        throw new Error("Kunne ikke hente historikk fra backend");
    }

    const matches = await matchesRes.json();
    const events = await eventsRes.json();

    let players = [];
    try {
        if (playersRes.ok) {
            players = await playersRes.json();
        }
    } catch {
        players = [];
    }

    const playersById = new Map(players.map(p => [Number(p.id), p]));

    return matches.map(match => {
        const eventsForMatch = events.filter(e => e.match_id === match.id);
        return {
            id: match.id,
            backendMatchId: match.id,
            source: "backend",
            date: match.date || new Date().toISOString(),
            data: buildSnapshotFromBackend(match, eventsForMatch, playersById)
        };
    });
}

export async function initHistorikk() {
    const listEl = document.getElementById("history-list");

    let history = [];

    try {
        history = await loadHistoryFromBackend();
    } catch (error) {
        console.error("Backend historikk feilet", error);
        listEl.textContent = "Kunne ikke hente kamper fra backend";
        return;
    }

    listEl.innerHTML = "";

    if (history.length === 0) {
        listEl.textContent = "Ingen kamper lagret";
        return;
    }

    history
        .slice()
        .reverse()  // nyeste først
        .forEach(match => {
            const item = document.createElement("div");
            item.classList.add("history-item");

            const { header } = match.data;
            const cleanedHeader = header.replace(/\s*\(HT:.*?\)/, "");

            const date = new Date(match.date).toLocaleDateString();
            
            item.innerHTML = `
                <div class="history-main">
                    <div class="history-title">${cleanedHeader}</div>
                    <div class="history-date">${date}</div>
                </div>

                <button class="delete-btn">✕</button>
            `;

            item.addEventListener("click", () => {
                window.__selectedMatchId = match.backendMatchId ?? match.id;
                window.__selectedMatchData = null;

                // ✅ naviger til rapport
                navigateTo("kamp-rapport");
            });

            const deleteBtn = item.querySelector(".delete-btn");

            deleteBtn.addEventListener("click", async (event) => {
                event.stopPropagation(); // ❗ hindrer at klikk åpner kampen

                const confirmed = confirm("Slette denne kampen?");
                if (!confirmed) return;

                const resolvedBackendMatchId = match.backendMatchId ?? match.id;

                if (resolvedBackendMatchId != null) {
                    try {
                        const res = await fetch(apiUrl(`/matches/${resolvedBackendMatchId}`), {
                            method: "DELETE"
                        });

                        if (!res.ok) {
                            let backendError = `Delete failed (${res.status})`;
                            try {
                                const body = await res.json();
                                backendError = body.error || backendError;
                            } catch {
                                // ignore parse errors
                            }
                            throw new Error(backendError);
                        }

                        const deleteResult = await res.json();
                        console.log("Backend delete result", deleteResult);

                        // Verifiser at kampen faktisk er borte fra backend før vi oppdaterer UI.
                        const verifyRes = await fetch(apiUrl("/matches"));
                        if (!verifyRes.ok) {
                            throw new Error(`Verification failed (${verifyRes.status})`);
                        }
                        const remainingMatches = await verifyRes.json();
                        const stillExists = remainingMatches.some(m => Number(m.id) === Number(resolvedBackendMatchId));
                        if (stillExists) {
                            throw new Error("Backend bekreftet sletting, men kampen finnes fortsatt i /matches. Mulig feil backend-instans/DB.");
                        }

                        history = history.filter(m => Number(m.backendMatchId) !== Number(resolvedBackendMatchId));
                    } catch (error) {
                        console.error("Sletting av backend-kamp feilet", error);
                        alert(`Kunne ikke slette kampen fra backend.\n\n${String(error?.message || "Ukjent feil")}`);
                        return;
                    }
                }

                // fjern fra UI
                item.remove();

                if (listEl.children.length === 0) {
                    listEl.textContent = "Ingen kamper lagret";
                }
            });
            

            listEl.appendChild(item);
        });
}

