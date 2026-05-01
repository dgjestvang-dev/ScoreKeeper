
import { createClock } from "./clock.js";
import { matchConfig } from "./match-config.js";
import { createMatchStats } from "./match-stats.js";
import { goBack } from "./navigation.js";



let clock;
let timeEl;
let startStopBtn;
let tickIntervalId = null;
let nextHalfBtn;
let homeTeamEl;
let awayTeamEl;
let halfValueEl;
let matchStats;
let resetMatchBtn;
let saveMatchBtn;


export function initStartKamp() {
    
     // ❗ Safety: clean up if re-entering the view
    stopTicking();
    tickIntervalId = null;

    if (!matchConfig.gametimeMinutes || !matchConfig.homeTeamName || !matchConfig.awayTeamName) {
        console.error("Gametime and teamnames not set");
        return;
    }

    const HALF_DURATION_SECONDS = matchConfig.gametimeMinutes * 60;

    clock = createClock(HALF_DURATION_SECONDS);

    
    const controlsEl = document.querySelector("#start-kamp .controls");

    if (!controlsEl) {
        console.error("Controls container not found");
        return;
    }

    controlsEl.addEventListener("click", onStatButtonClick);




    // --- Query DOM elements (view is now active) ---
    timeEl = document.querySelector("#start-kamp .clock .time");
    homeTeamEl = document.querySelector("#start-kamp .team.home");
    awayTeamEl = document.querySelector("#start-kamp .team.away");
    halfValueEl = document.querySelector("#start-kamp .gamehalf-value");

    // --- Prevent duplicate listeners by replacing buttons ---
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


    console.log("Reset button:", resetMatchBtn);
    //kamp stats:
    matchStats = createMatchStats();
    
    
    renderClock();
    renderHalf();
    renderTeams(); 
    renderScore();
    renderStatsSummary();

    updateStartStopButton();
    updateNextHalfButton();
    updateStatControls();

    startStopBtn.addEventListener("click", onStartStopClick);
    nextHalfBtn.addEventListener("click", onNextHalfClick);
    resetMatchBtn.addEventListener("click", onResetMatchClick);
    saveMatchBtn.addEventListener("click", onSaveMatchClick);
}


function onStartStopClick() {
    if (clock.isRunning()) {
        clock.pause();
        stopTicking();
    } else {
        clock.start();
        startTicking();
    }

    updateStartStopButton();
    updateStatControls();
}


function updateStartStopButton() {
    if (!startStopBtn) return;

    const labelEl = startStopBtn.querySelector(".label");
    if (!labelEl) return;

    const running = clock.isRunning();
    const half = clock.getCurrentHalf();
    const expired = clock.isExpired();

    const firstHalfEnded = expired && half === 1;
    const matchFinished = expired && half === 2;

    // Disable when half is over or match is finished
    startStopBtn.disabled = firstHalfEnded || matchFinished;

    // Visual running state
    startStopBtn.classList.toggle("running", running);

    // Label logic
    if (matchFinished) {
        labelEl.textContent = "Slutt";
    } else if (firstHalfEnded) {
        labelEl.textContent = "Pause";
    } else {
        labelEl.textContent = running ? "Stopp" : "Start";
    }
}


function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function renderClock() {
    if (!timeEl) return;
    timeEl.textContent = formatTime(clock.getRemainingSeconds());
}



document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        renderClock();
    }
});



function renderTeams() {
    if (!homeTeamEl) return;
    homeTeamEl.textContent = matchConfig.homeTeamName;
    awayTeamEl.textContent = matchConfig.awayTeamName;
}


function renderHalf() {
    if (!halfValueEl) return;
    halfValueEl.textContent = clock.getCurrentHalf();
}



function startTicking() {
    if (tickIntervalId !== null) return; // already ticking

    tickIntervalId = setInterval(() => {
        clock.tick();
        renderClock();

        // stop automatically if time runs out
        if (clock.isExpired()) {
            stopTicking();
            updateStartStopButton();
            updateNextHalfButton();
            updateStatControls()
        }
    }, 1000);
}

function stopTicking() {
    if (tickIntervalId === null) return;

    clearInterval(tickIntervalId);
    tickIntervalId = null;
}


//Neste omgang knappen
function onNextHalfClick() {
    clock.resetForNextHalf();

    renderClock();
    renderHalf();
    updateStartStopButton();
    updateNextHalfButton();
}


function updateNextHalfButton() {
    const canAdvance =
        clock.getCurrentHalf() === 1 &&
        clock.isExpired() &&
        !clock.isRunning();

    nextHalfBtn.disabled = !canAdvance;
}

// ONE click handler for all stat buttons
function onStatButtonClick(event) {
    
     // ⛔ Block stat changes when clock is not running
    if (!clock.isRunning()) {
        return;
    }

    const btn = event.target.closest("button[data-stat]");
    if (!btn) return;

    const team = btn.dataset.team;       // "home" | "away"
    const stat = btn.dataset.stat;       // "goals", "corners", ...
    const action = btn.dataset.action;   // "inc" | "dec"

    if (action === "inc") {
        matchStats.increment(team, stat);

        // ✅ Goal is also a shot on target (and a total shot)
        if (stat === "goals") {
            matchStats.increment(team, "shots_target");
            matchStats.increment(team, "shots_total");
        }

        // ✅ Shot on target is also a total shot
        if (stat === "shots_target") {
            matchStats.increment(team, "shots_total");
        }

    } else if (action === "dec") {
        matchStats.decrement(team, stat);

        // ✅ Undo goal effects
        if (stat === "goals") {
            matchStats.decrement(team, "shots_target");
            matchStats.decrement(team, "shots_total");
        }

        // ✅ Undo shot-on-target effect
        if (stat === "shots_target") {
            matchStats.decrement(team, "shots_total");
        }
    }


    // Dersom det er mål har det sin egen logikk --> renderScore
    if (stat === "goals") {
        renderScore();
        flashGoalScore();   
        renderStat("shots_target");
        renderStat("shots_total");

    } else {

    // oppdater statistikk + flash
    renderStat(stat);
    flashStat(stat, team);

    
    // ✅ Shots on target also affect total shots – update UI
    if (stat === "shots_target") {
        renderStat("shots_total");
    }


    }
}



function renderScore() {
    const homeGoals = matchStats.get("home", "goals");
    const awayGoals = matchStats.get("away", "goals");

    const scoreEl = document.querySelector("#start-kamp .score");
    scoreEl.textContent = `${homeGoals} – ${awayGoals}`;
}

function renderStatsSummary() {
    renderStat("corners");
    renderStat("shots_target");
    renderStat("shots_total");
    renderStat("yellow_card");
    renderStat("offside");
    renderStat("red_card");
}

//Jeg tror dette statistikkdelen. home- og away- er prefix

function renderStat(stat) {
    const homeEl = document.querySelector(
        `#start-kamp [data-summary="home-${stat}"]`
    );
    const awayEl = document.querySelector(
        `#start-kamp [data-summary="away-${stat}"]`
    );

    if (!homeEl || !awayEl) {
        console.warn(`Summary elements missing for stat: ${stat}`);
        return;
    }

    homeEl.textContent = matchStats.get("home", stat);
    awayEl.textContent = matchStats.get("away", stat);

    
}

function flash(el) {
    el.classList.remove("stat-flash"); // restart animation
    void el.offsetWidth;               // reflow trick
    el.classList.add("stat-flash");
}


function flashStat(stat, team) {
    const el = document.querySelector(
        `#start-kamp [data-summary="${team}-${stat}"]`
    );

    if (!el) return;

    flash(el);
}


function flashGoalScore() {
    const scoreEl = document.querySelector("#start-kamp .score");
    if (!scoreEl) return;

    scoreEl.classList.remove("flash-goal");
    void scoreEl.offsetWidth; // force reflow
    scoreEl.classList.add("flash-goal");
}

//Reset button fuctions:

function onResetMatchClick() {

    const confirmed = confirm(
        "Er du sikker på at du vil resette kampen? Dette vil nullstille klokke, omgang og all statistikk."
    );

    if (!confirmed) {
        return;
    }


    // 1️⃣ Stop ticking immediately
    stopTicking();

    // 2️⃣ Reset clock state
    clock.resetGame();

    // 3️⃣ Reset stats state
    matchStats.reset();

    // 4️⃣ Re-render everything
    renderClock();
    renderHalf();
    renderScore();
    renderStatsSummary();

    // 5️⃣ Update buttons
    updateStartStopButton();
    updateNextHalfButton();
    updateStatControls();
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


// Bygge eksport til clipboard:

function buildMatchSummary() {
    const home = matchConfig.homeTeamName;
    const away = matchConfig.awayTeamName;

    const homeGoals = matchStats.get("home", "goals");
    const awayGoals = matchStats.get("away", "goals");

    const half = clock.getCurrentHalf();
    const time = formatTime(clock.getRemainingSeconds());

    return `
${home} - ${away}: ${homeGoals} – ${awayGoals} 

STATISTIKK
Avslutninger: ${matchStats.get("home", "shots_total")} – ${matchStats.get("away", "shots_total")}
Skudd på mål: ${matchStats.get("home", "shots_target")} – ${matchStats.get("away", "shots_target")}
Corner: ${matchStats.get("home", "corners")} – ${matchStats.get("away", "corners")}
Offside: ${matchStats.get("home", "offside")} – ${matchStats.get("away", "offside")}
Gult kort: ${matchStats.get("home", "yellow_card")} – ${matchStats.get("away", "yellow_card")}
Rødt kort: ${matchStats.get("home", "red_card")} – ${matchStats.get("away", "red_card")}
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

    goBack();
}