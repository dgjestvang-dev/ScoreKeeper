// ─────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────

import { createClock } from "../../core/clock.js";
import { matchConfig } from "../../config/match-config.js";
import { goBack, navigateTo } from "../../navigation.js";
import { generateId } from "../../utils.js";

import { getTeams, getPlayersForTeam } from "../../core/teams.js";
import { openPlayerAssign } from "../../components/player-assign-ui.js";





// ─────────────────────────────────────────────
// Match‑scoped state & DOM references
// ─────────────────────────────────────────────

let clock;
let tickIntervalId = null;

let timeEl;
let startStopBtn;
let nextHalfBtn;
let resetMatchBtn;
let saveMatchBtn;

let homeTeamEl;
let awayTeamEl;
let halfValueEl;

let hasStarted = false;

// Event‑sourced match data (single source of truth)
let matchEvents = [];

let pendingGoalEvent = null;


// ─────────────────────────────────────────────
// TEMP players and TEAMS for Phase 2b Will be replaced by real team data later.
// ─────────────────────────────────────────────


// TEMP: team IDs for the current match
let homeTeamId = null;
let awayTeamId = null;


// ─────────────────────────────────────────────
// Initialization / view entry point
// ─────────────────────────────────────────────

export function initStartKamp() {

    console.log("initStartKamp CALLED");

        
    homeTeamId = matchConfig.homeTeamId ?? null;
    awayTeamId = matchConfig.awayTeamId ?? null;

    // ✅ Ikke stopp hvis lag mangler ID
    if (!matchConfig.homeTeamName || !matchConfig.awayTeamName) {
        console.error("Team names missing");
        return;
    }



    // Safety: clean up if re‑entering the view
    stopTicking();
    tickIntervalId = null;

    if (
        !matchConfig.gametimeMinutes ||
        !matchConfig.homeTeamName ||
        !matchConfig.awayTeamName
    ) {
        console.error("Gametime and teamnames not set");
        return;
    }

    const HALF_DURATION_SECONDS = matchConfig.gametimeMinutes * 60;
    clock = createClock(HALF_DURATION_SECONDS);

    // Attach delegated stat handler
    const controlsEl = document.querySelector("#start-kamp .controls");
    if (!controlsEl) {
        console.error("Controls container not found");
        return;
    }
    controlsEl.addEventListener("click", onStatButtonClick);

    const reportBtn = document.getElementById("game-report-btn");

    reportBtn.addEventListener("click", () => {
        navigateTo("kamp-rapport");
    });


    // Query DOM (view is now active)
    timeEl = document.querySelector("#start-kamp .clock .time");
    homeTeamEl = document.querySelector("#start-kamp .team.home");
    awayTeamEl = document.querySelector("#start-kamp .team.away");
    halfValueEl = document.querySelector("#start-kamp .gamehalf-value");  

    // Replace buttons to prevent duplicate listeners
    startStopBtn = document.getElementById("start-stop-btn");
    startStopBtn.replaceWith(startStopBtn.cloneNode(true));
    startStopBtn = document.getElementById("start-stop-btn");

    nextHalfBtn = document.getElementById("next-half-btn");
    nextHalfBtn.replaceWith(nextHalfBtn.cloneNode(true));
    nextHalfBtn = document.getElementById("next-half-btn");

    resetMatchBtn = document.getElementById("reset-match-btn");
    resetMatchBtn.replaceWith(resetMatchBtn.cloneNode(true));
    resetMatchBtn = document.getElementById("reset-match-btn");

    saveMatchBtn = document.getElementById("save-match-btn");
    saveMatchBtn.replaceWith(saveMatchBtn.cloneNode(true));
    saveMatchBtn = document.getElementById("save-match-btn");

    
    // Backend is the only persistence layer; active match state stays in memory.
    matchEvents = [];
    hasStarted = false;


    // Initial render
    renderClock();
    renderHalf();
    renderTeams();
    renderScore();
    renderStatsSummary();

    // Wire controls
    startStopBtn.addEventListener("click", onStartStopClick);
    nextHalfBtn.addEventListener("click", onNextHalfClick);
    resetMatchBtn.addEventListener("click", onResetMatchClick);
    saveMatchBtn.addEventListener("click", onBackClick);

    
// Ensure final button state after DOM settles
requestAnimationFrame(() => {
    updateMatchControls();
});




}




// ─────────────────────────────────────────────
// Clock reconciliation & match control logic
// ─────────────────────────────────────────────

function reconcileClockState() {
    if (!clock) return;

    if (clock.isExpired() && clock.isRunning()) {
        clock.pause();
        stopTicking();
    }
}

function onStartStopClick() {
    reconcileClockState();

    if (clock.isRunning()) {
        clock.pause();
        stopTicking();
    } else {
        clock.start();
        hasStarted = true;
        startTicking();
    }
    
    updateMatchControls();
}

function updateMatchControls() {
    if (!clock) return;   
    reconcileClockState();

    const running = clock.isRunning();
    const expired = clock.isExpired();
    const half = clock.getCurrentHalf();

    // Start / Stop button
    if (expired && half === 2) {
        startStopBtn.disabled = true;
        startStopBtn.querySelector(".label").textContent = "Slutt";
    } else if (expired && half === 1) {
        startStopBtn.disabled = true;
        startStopBtn.querySelector(".label").textContent = "Pause";
    } else {
        startStopBtn.disabled = false;
        startStopBtn.querySelector(".label").textContent =
            running ? "Stopp" : "Start";
    }

    startStopBtn.classList.toggle("running", running);

    // Advance to next half
    nextHalfBtn.disabled = !(
        hasStarted &&
        expired &&
        !running &&
        half === 1
    );

    updateStatControls();

    console.log("Match control state", {
        expired,
        running,
        half,
        resetHalfDisabled: nextHalfBtn.disabled
    });
}


// ─────────────────────────────────────────────
// Time / ticking
// ─────────────────────────────────────────────

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function renderClock() {
    if (!timeEl) return;
    timeEl.textContent = formatTime(clock.getRemainingSeconds());
}

function startTicking() {
    if (tickIntervalId !== null) return;

    tickIntervalId = setInterval(() => {
        reconcileClockState();
        renderClock();
        updateMatchControls();
    }, 1000);
}

function stopTicking() {
    if (tickIntervalId === null) return;
    clearInterval(tickIntervalId);
    tickIntervalId = null;
}

// Recover cleanly when tab regains focus
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        reconcileClockState();
        renderClock();
        updateMatchControls();
    }
});


// ─────────────────────────────────────────────
// Half / team rendering
// ─────────────────────────────────────────────

function renderTeams() {
    if (!homeTeamEl) return;
    homeTeamEl.textContent = matchConfig.homeTeamName;
    awayTeamEl.textContent = matchConfig.awayTeamName;
}

function renderHalf() {
    if (!halfValueEl) return;
    halfValueEl.textContent = clock.getCurrentHalf();
}

function onNextHalfClick() {
    if (
        clock.getCurrentHalf() !== 1 ||
        !clock.isExpired() ||
        clock.isRunning()
    ) {
        return;
    }

    clock.resetForNextHalf();
    renderClock();
    renderHalf();
    updateMatchControls();
}


// ─────────────────────────────────────────────
// Event‑sourced statistics (core logic)
// ─────────────────────────────────────────────

function deriveStats(events) {
    const stats = { home: {}, away: {} };

    for (const event of events) {
        if (!event.team) continue;

        const bucket = stats[event.team];
        bucket[event.type] = (bucket[event.type] || 0) + 1;
    }

    return stats;
}

function hasRedCard(playerId, team) {
    return matchEvents.some(e =>
        e.type === "red_card" &&
        e.playerId === playerId &&
        e.team === team
    );
}


function isMyTeamName(teamName) {
    const teams = getTeams(); 

    return Object.values(teams).some(t =>
        t.name.trim().toLowerCase() === teamName.trim().toLowerCase()
    );
}

//onStatButtonClick
//├── handleDecrement
//├── handleGoal
//├── handleCard
//├── handleSimpleStat 

// 1 HOVEDFUKSJON//


function onStatButtonClick(event) {
    if (!clock.isRunning()) return;

    const btn = event.target.closest("button[data-stat]");
    if (!btn) return;

    const team = btn.dataset.team;
    const stat = btn.dataset.stat;
    const action = btn.dataset.action;

    const half = clock.getCurrentHalf();
    const time = clock.getElapsedSeconds();
    const timestamp = Date.now();

    const homeIsMine = isMyTeamName(matchConfig.homeTeamName);
    const awayIsMine = isMyTeamName(matchConfig.awayTeamName);

    const isMyTeam =
        (team === "home" && homeIsMine) ||
        (team === "away" && awayIsMine);

    if (action === "dec") {
        handleDecrement(team, stat);
        return;
    }

    if (stat === "goals") {
        handleGoal(team, isMyTeam, half, time, timestamp);
        return;
    }

    if (stat === "yellow_card" || stat === "red_card") {
        handleCard(team, stat, isMyTeam, half, time, timestamp);
        return;
    }

    handleSimpleStat(team, stat, half, time, timestamp);
}


// 2. MÅL //

function handleGoal(team, isMyTeam, half, time, timestamp) {
    const teamId = team === "home" ? homeTeamId ?? null : awayTeamId ?? null;

    const baseEvent = {
        id: generateId(),
        type: "goals",
        team,
        teamId,
        playerId: null,
        half,
        time,
        timestamp
    };

    matchEvents.push(baseEvent);

matchEvents.push({
    id: generateId(),
    type: "shots_target",
    team,
    teamId,
    playerId: null,
    half,
    time,
    timestamp
});

matchEvents.push({
    id: generateId(),
    type: "shots_total",
    team,
    teamId,
    playerId: null,
    half,
    time,
    timestamp
});

// ✅ 🔥 Oppdater score og flash MED EN GANG
renderScore();
flashGoalScore();


// motstander → ferdig her
if (!isMyTeam) {
    saveAndRender();
    return;
}

    pendingGoalEvent = {
        baseEvent,
        team,
        teamId,
        scorerId: null,
        assistId: null,
        half,
        time,
        timestamp
    };

    const players = getPlayersForTeam(teamId) || [];

    const playersWithOwnGoal = [
        { id: "__OWN_GOAL__", name: "Selvmål", shirt: "" },
        ...players
    ];

    openPlayerAssign(
        playersWithOwnGoal,
        (playerId) => {
            if (!playerId) return;

            if (playerId === "__OWN_GOAL__") {
                baseEvent.playerId = null;
                baseEvent.isOwnGoal = true;
                finalizeOwnGoal(baseEvent);
                return;
            }

            pendingGoalEvent.scorerId = playerId;
            baseEvent.playerId = playerId;

            openAssistAssign(players, playerId);
        },
        {
            title: "Hvem scoret?",
            skipLabel: "Avbryt"
        }
    );
}

// 3. KORT //

function handleCard(team, stat, isMyTeam, half, time, timestamp) {
    const teamId = team === "home" ? homeTeamId ?? null : awayTeamId ?? null;

    const baseEvent = {
        id: generateId(),
        type: stat,
        team,
        teamId,
        playerId: null,
        half,
        time,
        timestamp
    };

    matchEvents.push(baseEvent);

    if (!isMyTeam) {
        saveAndRender();
        return;
    }

    const teamPlayers =
        (getPlayersForTeam(teamId) || [])
        .filter(p => !hasRedCard(p.id, team));

    openPlayerAssign(
        teamPlayers,
        (playerId) => {
            if (!playerId) {
                matchEvents.pop();
                return;
            }

            baseEvent.playerId = playerId;

            if (stat === "yellow_card") {
                const yellowCount = matchEvents.filter(e =>
                    e.type === "yellow_card" &&
                    e.team === team &&
                    e.playerId === playerId
                ).length;

                if (yellowCount === 2) {
                    matchEvents.push({
                        id: generateId(),
                        type: "red_card",
                        team,
                        teamId,
                        playerId,
                        half,
                        time,
                        timestamp
                    });
                }
            }

            saveAndRender();
        },
        {
            title: stat === "yellow_card"
                ? "Hvem fikk gult kort?"
                : "Hvem fikk rødt kort?",
            skipLabel: "Avbryt"
        }
    );
}

// 4. SIMLE STATS --> RESTEN (eks corner, skudd)

function handleSimpleStat(team, stat, half, time, timestamp) {
    const teamId = team === "home" ? homeTeamId ?? null : awayTeamId ?? null;

    const baseEvent = {
        id: generateId(),
        type: stat,
        team,
        teamId,
        playerId: null,
        half,
        time,
        timestamp
    };

    matchEvents.push(baseEvent);

    // shot_target → total
    if (stat === "shots_target") {
        matchEvents.push({
            id: generateId(),
            type: "shots_total",
            team,
            teamId,
            playerId: null,
            half,
            time,
            timestamp
        });
    }

    flashStat(stat, team);
    saveAndRender();
}

// 5. MINUS KNAPPENE //

function handleDecrement(team, stat) {
    function removeLast(type) {
        for (let i = matchEvents.length - 1; i >= 0; i--) {
            const e = matchEvents[i];
            if (e.type === type && e.team === team) {
                matchEvents.splice(i, 1);
                return;
            }
        }
    }

    removeLast(stat);

    if (stat === "goals") {
        removeLast("shots_target");
        removeLast("shots_total");
    }

    if (stat === "shots_target") {
        removeLast("shots_total");
    }

    saveAndRender();
    renderScore();
}

// 6. HELPER //

function saveAndRender() {
    renderStatsSummary();
}


function openAssistAssign(players, scorerId) {
    // Filtrer bort målscorer
    const assistPlayers = players.filter(p => p.id !== scorerId);

    openPlayerAssign(assistPlayers, (assistId) => {
        // assist er valgfri
        pendingGoalEvent.assistId = assistId || null;

        finalizeGoalEvent();
    }, {
        title: "Hvem hadde assist? (valgfritt)",
        skipLabel: "Ingen assist"
    });
}


function finalizeGoalEvent() {
    const { baseEvent, assistId } = pendingGoalEvent;

    if (assistId) {
        matchEvents.push({
            id: generateId(),
            type: "assists",
            team: baseEvent.team,
            teamId: baseEvent.teamId,
            playerId: assistId,
            half: baseEvent.half,
            time: baseEvent.time,
            timestamp: baseEvent.timestamp
        });
    }

    renderScore();
    renderStatsSummary();

    pendingGoalEvent = null;
}

function finalizeOwnGoal(baseEvent) {
    baseEvent.isOwnGoal = true;

    renderScore();
    renderStatsSummary();

    pendingGoalEvent = null;
}



// ─────────────────────────────────────────────
// UI rendering from derived stats
// ─────────────────────────────────────────────

function renderScore() {
    const stats = deriveStats(matchEvents);
    const homeGoals = stats.home.goals || 0;
    const awayGoals = stats.away.goals || 0;

    const scoreEl = document.querySelector("#start-kamp .score");
    scoreEl.textContent = `${homeGoals} – ${awayGoals}`;
}

function renderStatsSummary() {
    renderStat("corners");
    renderStat("shots_target");
    renderStat("shots_total");
    renderStat("assists"); 
    renderStat("yellow_card");
    renderStat("offside");
    renderStat("red_card");
}

function renderStat(stat) {
    const stats = deriveStats(matchEvents);

    const homeValue = stats.home[stat] || 0;
    const awayValue = stats.away[stat] || 0;

    const homeEl = document.querySelector(`#start-kamp [data-summary="home-${stat}"]`);
    const awayEl = document.querySelector(`#start-kamp [data-summary="away-${stat}"]`);

    if (!homeEl || !awayEl) return;

    homeEl.textContent = homeValue;
    awayEl.textContent = awayValue;
}


// ─────────────────────────────────────────────
// Visual feedback (animations)
// ─────────────────────────────────────────────

function flash(el) {
    el.classList.remove("stat-flash");
    void el.offsetWidth;
    el.classList.add("stat-flash");
}

function flashStat(stat, team) {
    const el = document.querySelector(`#start-kamp [data-summary="${team}-${stat}"]`);
    if (!el) return;
    flash(el);
}

function flashGoalScore() {
    const scoreEl = document.querySelector("#start-kamp .score");
    if (!scoreEl) return;

    scoreEl.classList.remove("flash-goal");
    void scoreEl.offsetWidth;
    scoreEl.classList.add("flash-goal");
}


// ─────────────────────────────────────────────
// Reset & stat control helpers
// ─────────────────────────────────────────────

function onResetMatchClick() {

    const confirmed = confirm(
        "Er du sikker på at du vil resette kampen? Dette vil nullstille klokke, omgang og all statistikk."
    );
    if (!confirmed) return;

    matchEvents = [];
    hasStarted = false;

    stopTicking();
    clock.resetGame();

    renderClock();
    renderHalf();
    renderScore();
    renderStatsSummary();
    updateMatchControls();
    
}

function updateStatControls() {
    const controlsEl = document.querySelector("#start-kamp .controls");
    const disabled = !clock.isRunning();

    controlsEl.classList.toggle("disabled", disabled);

    controlsEl
        .querySelectorAll("button[data-stat]")
        .forEach(btn => {
            btn.disabled = disabled;
        });
}


// ─────────────────────────────────────────────
// Event aggregation & export helpers
// ─────────────────────────────────────────────

function countEvents({ type, team, half = null }) {
    return matchEvents.filter(e =>
        e.type === type &&
        e.team === team &&
        (half === null || e.half === half)
    ).length;
}


function formatStatLine(label, type) {
    const homeFull = countEvents({ type, team: "home" }) || 0;
    const awayFull = countEvents({ type, team: "away" }) || 0;

    const homeHT = countEvents({ type, team: "home", half: 1 }) || 0;
    const awayHT = countEvents({ type, team: "away", half: 1 }) || 0;

    return `${label}: ${homeFull} – ${awayFull} (HT: ${homeHT} – ${awayHT})`;
}




function getPlayerName(playerId, team) {
    if (!playerId) {
        const teamName =
            team === "home"
                ? matchConfig.homeTeamName
                : matchConfig.awayTeamName;

        return `(${teamName})`;
    }


    const player =
        getPlayersForTeam(homeTeamId)?.find(p => p.id === playerId) ||
        getPlayersForTeam(awayTeamId)?.find(p => p.id === playerId);

    if (!player) return "(Ikke angitt spiller)";

    return `#${player.shirt} ${player.name}`;
}

function formatGoalsWithPlayers() {
    const goalEvents = matchEvents
        .filter(e => e.type === "goals")
        .sort((a, b) => {
            if (a.half !== b.half) return a.half - b.half;
            return a.time - b.time;
        });

    if (goalEvents.length === 0) {
        return "Ingen mål";
    }

    let homeGoals = 0;
    let awayGoals = 0;
    let currentHalf = goalEvents[0].half;

    const lines = [];

    for (const event of goalEvents) {

        if (event.half !== currentHalf) {
            lines.push("-------- Pause --------");
            currentHalf = event.half;
        }

        if (event.team === "home") {
            homeGoals++;
        } else {
            awayGoals++;
        }

        const minute = Math.floor(event.time / 60) + 1 + "'";
        const score = `${homeGoals}–${awayGoals}`;        
        
        // 🔍 Finn eventuell assist for dette målet
        const assistEvent = matchEvents.find(e =>
            e.type === "assists" &&
            e.team === event.team &&
            e.half === event.half &&
            e.time === event.time
        );

        const playerName = event.isOwnGoal
            ? "Selvmål"
            : getPlayerName(event.playerId, event.team);

        
        const assistText = assistEvent
            ? ` (${getPlayerName(assistEvent.playerId, assistEvent.team)})`
            : "";



        lines.push(`${minute}   ${score}   ${playerName}${assistText}`);
    }

    return lines.join("\n");
}

function formatCardsWithPlayers() {
    const cardEvents = matchEvents
        .filter(e => e.type === "yellow_card" || e.type === "red_card")
        .sort((a, b) => {
            if (a.half !== b.half) return a.half - b.half;
            return a.time - b.time;
        });

    if (cardEvents.length === 0) {
        return "Ingen kort";
    }

    const lines = [];
    const usedEventIds = new Set();

    for (const event of cardEvents) {
        if (usedEventIds.has(event.id)) continue;

        // 🔍 Finn alle kort for samme spiller, lag og tidspunkt
        const sameMoment = cardEvents.filter(e =>
            e.team === event.team &&
            e.playerId === event.playerId &&
            e.half === event.half &&
            e.time === event.time
        );

        // Marker dem som brukt
        sameMoment.forEach(e => usedEventIds.add(e.id));

        const minute = Math.floor(event.time / 60) + 1 + "'";
        const yellows = sameMoment.filter(e => e.type === "yellow_card").length;
        const reds = sameMoment.filter(e => e.type === "red_card").length;

        let symbol = "";
        if (yellows === 2 && reds === 1) {
            symbol = "🟨🟨🟥";
        } else {
            symbol =
                "🟨".repeat(yellows) +
                "🟥".repeat(reds);
        }

        const playerName = getPlayerName(event.playerId, event.team);

        lines.push(`${minute}   ${symbol}   ${playerName}`);
    }

    return lines.join("\n");
}



// ─────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────

export function buildMatchSummaryParts() {
    const home = matchConfig.homeTeamName;
    const away = matchConfig.awayTeamName;

    const homeFT = countEvents({ type: "goals", team: "home" });
    const awayFT = countEvents({ type: "goals", team: "away" });

    const homeHT = countEvents({ type: "goals", team: "home", half: 1 });
    const awayHT = countEvents({ type: "goals", team: "away", half: 1 });
    
    return {
        header: `${home} - ${away}: ${homeFT} – ${awayFT}  (HT: ${homeHT} – ${awayHT})`,
        events: formatGoalsWithPlayers().split("\n"),
        cards: formatCardsWithPlayers().split("\n"),
        stats: [
            formatStatLine("Avslutninger", "shots_total"),
            formatStatLine("Skudd på mål", "shots_target"),
            formatStatLine("Corner", "corners"),
            formatStatLine("Offside", "offside"),
            formatStatLine("Gult kort", "yellow_card"),
            formatStatLine("Rødt kort", "red_card")
        ]
    };
}


function toBackendMinute(eventTimeSeconds) {
    const seconds = Number(eventTimeSeconds);
    if (!Number.isFinite(seconds) || seconds < 0) return 1;
    return Math.floor(seconds / 60) + 1;
}

function mapEventForBackend(event) {
    return {
        type: event.type,
        team: event.team,
        player_id: event.playerId ?? null,
        half: event.half ?? null,
        minute: toBackendMinute(event.time),
        timestamp: Number.isFinite(Number(event.timestamp))
            ? Number(event.timestamp)
            : Date.now()
    };
}

function buildSaveMatchPayload() {
    const today = new Date().toISOString().split("T")[0];

    return {
        match: {
            home_team_id: homeTeamId,
            home_team_name: matchConfig.homeTeamName,
            away_team_id: awayTeamId,
            away_team_name: matchConfig.awayTeamName,
            date: today
        },
        events: matchEvents.map(mapEventForBackend)
    };
}


async function onBackClick() {

    const confirmed = confirm(
        "Vil du lagre og avslutte kampen?\n\nKampdata lagres til backend før kampen lukkes."
    );

    if (!confirmed) return;

    const payload = buildSaveMatchPayload();

    let savedBackendMatchId = null;

    try {
        const response = await fetch("http://localhost:5000/save-match", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let backendError = "Unknown backend error";
            try {
                const errorBody = await response.json();
                backendError = errorBody.error || JSON.stringify(errorBody);
            } catch {
                backendError = await response.text();
            }

            throw new Error(`Save failed (${response.status}): ${backendError}`);
        }

        const saveResult = await response.json();
        savedBackendMatchId = saveResult?.match_id ?? null;
    } catch (error) {
        console.error("Failed to save match to backend", error);

        const message = String(error?.message || "");
        const isNetworkError =
            message.includes("Failed to fetch") ||
            message.includes("NetworkError") ||
            message.includes("Load failed");

        if (isNetworkError) {
            alert("Kunne ikke koble til backend på http://localhost:5000. Sjekk at backend kjører, og prøv igjen.\n\nKampen er fortsatt aktiv.");
        } else {
            alert(`Kunne ikke lagre kampen til backend.\n\n${message}\n\nKampen er fortsatt aktiv, prøv igjen.`);
        }
        return;
    }

    // 🔥 ✅ LAG SNAPSHOT FØRST (VIKTIG!)
    // ✅ SÅ nullstill kamp
    matchEvents = [];
    hasStarted = false;

    stopTicking();
    clock?.resetGame?.();

    // ✅ til slutt: naviger
    goBack();
}


