// ─────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────

import { createClock } from "./clock.js";
import { matchConfig } from "./match-config.js";
import { goBack } from "./navigation.js";
import { generateId } from "./utils.js";

import { loadFromStorage, saveToStorage } from "./storage.js";
import { getTeams, getPlayersForTeam } from "./teams.js";
import { openPlayerAssign } from "./player-assign-ui.js";




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
// CREATE LOCAL STORAGE
// ─────────────────────────────────────────────

const STORAGE_KEYS = {
    CURRENT_MATCH_EVENTS: "sk_current_match_events",
    CURRENT_MATCH_META: "sk_current_match_meta"
};

// ─────────────────────────────────────────────
// Initialization / view entry point
// ─────────────────────────────────────────────

export function initStartKamp() {

        
    homeTeamId = matchConfig.homeTeamId;
    awayTeamId = matchConfig.awayTeamId;

    if (!homeTeamId || !awayTeamId) {
        console.error("Team IDs missing for match");
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

    
    // Restore persisted match state (if any)
    matchEvents = loadFromStorage(
        STORAGE_KEYS.CURRENT_MATCH_EVENTS,
        []
    );

    hasStarted = loadFromStorage(
        STORAGE_KEYS.CURRENT_MATCH_META,
        { hasStarted: false }
    ).hasStarted;


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
    saveMatchBtn.addEventListener("click", onSaveMatchClick);

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
    
    saveToStorage(STORAGE_KEYS.CURRENT_MATCH_META, { hasStarted });

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

function onStatButtonClick(event) {
    // ⛔ Ingen stats hvis kampen ikke går
    if (!clock.isRunning()) return;

    const btn = event.target.closest("button[data-stat]");
    if (!btn) return;

    const team = btn.dataset.team;       // "home" | "away"
    const stat = btn.dataset.stat;       // "goals", "shots_target", ...
    const action = btn.dataset.action;   // "inc" | "dec"

    const half = clock.getCurrentHalf();
    const time = clock.getElapsedSeconds();
    const timestamp = Date.now();

    let baseEvent = null; // ← brukes for goals

    if (action === "inc") {

        // ✅ Hoved-event (ALLTID denne som er "brukerhandlingen")
        baseEvent = {
            id: generateId(),
            type: stat,
            team,
            teamId: team === "home" ? homeTeamId : awayTeamId,
            playerId: null,
            half,
            time,
            timestamp
        };

        matchEvents.push(baseEvent);

        // ✅ Domene-relasjoner
        if (stat === "goals") {
            matchEvents.push({
                id: generateId(),
                type: "shots_target",
                team,
                teamId: baseEvent.teamId,
                playerId: null,
                half,
                time,
                timestamp
            });

            matchEvents.push({
                id: generateId(),
                type: "shots_total",
                team,
                teamId: baseEvent.teamId,
                playerId: null,
                half,
                time,
                timestamp
            });
        }

        if (stat === "shots_target") {
            matchEvents.push({
                id: generateId(),
                type: "shots_total",
                team,
                teamId: baseEvent.teamId,
                playerId: null,
                half,
                time,
                timestamp
            });
        }

    } else if (action === "dec") {

        // ❌ Fjerne siste relevante event for dette laget
        function removeLastEvent(type) {
            for (let i = matchEvents.length - 1; i >= 0; i--) {
                const e = matchEvents[i];
                if (e.type === type && e.team === team) {
                    matchEvents.splice(i, 1);
                    return;
                }
            }
        }

        removeLastEvent(stat);

        if (stat === "goals") {
            removeLastEvent("shots_target");
            removeLastEvent("shots_total");
        }

        if (stat === "shots_target") {
            removeLastEvent("shots_total");
        }
    }

    // 🔄 UI-oppdatering
    renderScore();
    renderStatsSummary();

    // ✅ Spillervalgs-popup KUN for goals (utvidet med assist-flyt)
    if (stat === "goals" && action === "inc" && baseEvent) {
    flashGoalScore();

    // ▶️ Opprett pendingGoalEvent HER
    pendingGoalEvent = {
        baseEvent,
        team,
        teamId: baseEvent.teamId,
        scorerId: null,
        assistId: null,
        half,
        time,
        timestamp
    };

    const teamPlayers =
        team === "home"
            ? getPlayersForTeam(homeTeamId)
            : getPlayersForTeam(awayTeamId);

    
    const playersWithOwnGoal = [
        {
            id: "__OWN_GOAL__",
            name: "Selvmål",
            shirt: ""
        },
        ...teamPlayers
    ];

    openPlayerAssign(
    playersWithOwnGoal,
    (playerId) => {
        if (!playerId) return;

        // ✅ Selvmål valgt
        if (playerId === "__OWN_GOAL__") {
            baseEvent.playerId = null;
            baseEvent.isOwnGoal = true;

            finalizeOwnGoal(baseEvent);
            return;
        }

        // ✅ Vanlig mål
        pendingGoalEvent.scorerId = playerId;
        baseEvent.playerId = playerId;

        openAssistAssign(teamPlayers, playerId);
    },
    {
        title: "Hvem scoret?",
        skipLabel: "Avbryt"
    }
);
}


    flashStat(stat, team);

    // ✅ Lagre alltid etter synkrone endringer
    saveToStorage(
        STORAGE_KEYS.CURRENT_MATCH_EVENTS,
        matchEvents
    );
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

    // ✅ Registrer assist som eget event (hvis valgt)
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

    
function finalizeOwnGoal(baseEvent) {
    // marker eksplisitt
    baseEvent.isOwnGoal = true;

    saveToStorage(
        STORAGE_KEYS.CURRENT_MATCH_EVENTS,
        matchEvents
    );

    renderStatsSummary();
    pendingGoalEvent = null;
}


    // ✅ Lagre alt ferdig
    saveToStorage(
        STORAGE_KEYS.CURRENT_MATCH_EVENTS,
        matchEvents
    );

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
    
    saveToStorage(STORAGE_KEYS.CURRENT_MATCH_EVENTS, []);
    saveToStorage(STORAGE_KEYS.CURRENT_MATCH_META, { hasStarted: false });

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
    const homeFull = countEvents({ type, team: "home" });
    const awayFull = countEvents({ type, team: "away" });
    const homeHT = countEvents({ type, team: "home", half: 1 });
    const awayHT = countEvents({ type, team: "away", half: 1 });

    return `${label}: ${homeFull} – ${awayFull}  (HT: ${homeHT} – ${awayHT})`;
}

function getPlayerName(playerId) {
    if (!playerId) return "(Ikke angitt spiller)";

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
            : getPlayerName(event.playerId);

        const assistText = assistEvent
            ? ` (${getPlayerName(assistEvent.playerId)})`
            : "";


        lines.push(`${minute}   ${score}   ${playerName}${assistText}`);
    }

    return lines.join("\n");
}

// ─────────────────────────────────────────────
// Export / navigation
// ─────────────────────────────────────────────

function buildMatchSummary() {
    const home = matchConfig.homeTeamName;
    const away = matchConfig.awayTeamName;

    const homeFT = countEvents({ type: "goals", team: "home" });
    const awayFT = countEvents({ type: "goals", team: "away" });
    const homeHT = countEvents({ type: "goals", team: "home", half: 1 });
    const awayHT = countEvents({ type: "goals", team: "away", half: 1 });

    return `
${home} - ${away}: ${homeFT} – ${awayFT}  (HT: ${homeHT} – ${awayHT})

MÅL
${formatGoalsWithPlayers()}

STATISTIKK
${formatStatLine("Avslutninger", "shots_total")}
${formatStatLine("Skudd på mål", "shots_target")}
${formatStatLine("Corner", "corners")}
${formatStatLine("Offside", "offside")}
${formatStatLine("Gult kort", "yellow_card")}
${formatStatLine("Rødt kort", "red_card")}
`.trim();
}

async function onSaveMatchClick() {
    const summary = buildMatchSummary();

    try {
        await navigator.clipboard.writeText(summary);
        alert("Kampoppsummering kopiert til utklippstavlen.");
    } catch (err) {
        alert("Kunne ikke kopiere. Prøv igjen.");
        console.error(err);
        return;
    }

    saveToStorage(STORAGE_KEYS.CURRENT_MATCH_EVENTS, []);
    saveToStorage(STORAGE_KEYS.CURRENT_MATCH_META, { hasStarted: false });

    goBack();
}