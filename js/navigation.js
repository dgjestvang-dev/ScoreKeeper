// ==============================
// Navigation state
// ==============================

console.log("navigation.js STARTING");

const historyStack = [];


// ==============================
// Global click handler
// ==============================

document.addEventListener("click", (event) => {
    const navTarget = event.target.closest("[data-nav]");
    if (navTarget) {
        navigateTo(navTarget.dataset.nav);
        return;
    }

    const backTarget = event.target.closest("[data-back]");
    if (backTarget) {
        goBack();
    }
});


// ==============================
// Forward navigation (PUSH)
// ==============================

export function navigateTo(id) {
    const current = document.querySelector(".view.active");
    const next = document.getElementById(id);

    if (!next || next === current) return;

    if (current) {
        historyStack.push(current.id);
        current.classList.remove("active");
        current.classList.add("back");
    }

    next.classList.remove("back");
    next.classList.add("active");

    activateView(id);
}


// ==============================
// Replace navigation
// ==============================

export function navigateToReplacingCurrent(id) {
    const current = document.querySelector(".view.active");
    const next = document.getElementById(id);

    if (!next || next === current) return;

    if (historyStack.length > 0) {
        historyStack.pop();
    }

    if (current) {
        current.classList.remove("active");
        current.classList.add("back");
    }

    next.classList.remove("back");
    next.classList.add("active");

    activateView(id);
}


// ==============================
// Back navigation (POP)
// ==============================

export function goBack() {
    if (historyStack.length === 0) return;

    const current = document.querySelector(".view.active");
    const previousId = historyStack.pop();
    const previous = document.getElementById(previousId);

    if (!previous) return;

    if (current) {
        current.classList.remove("active");
        current.classList.add("back");
    }

    previous.classList.remove("back");
    previous.classList.add("active");

    activateView(previousId);
}


// ==============================
// View activation
// ==============================

import { initKampdag } from "./pages/match/kampdag.js";
import { initStartKamp } from "./pages/match/start-kamp.js";
import { initMineLag } from "./pages/teams/mine-lag.js";
import { initNyttLag } from "./pages/teams/nytt-lag.js";
import { initLagDetaljer } from "./pages/teams/lagdetaljer.js";
import { initNySpiller } from "./pages/players/ny-spiller.js";
import { initRedigerSpiller } from "./pages/players/rediger-spiller.js";
import { initRedigerLag } from "./pages/teams/rediger-lag.js";
import { initKampRapport } from "./pages/match/kamp-rapport.js";
import { initHistorikk } from "./pages/historikk.js";

function activateView(viewId) {
    const screenBg = document.querySelector(".screen-bg");

    screenBg.classList.remove("bg-home", "bg-app");

    const homeLikeViews = ["home", "main_menu"];

    if (homeLikeViews.includes(viewId)) {
        screenBg.classList.add("bg-home");
    } else {
        screenBg.classList.add("bg-app");
    }

    if (viewId === "kampdag") {
        initKampdag();
    } else if (viewId === "start-kamp") {
        initStartKamp();
    } else if (viewId === "mine-lag") {
        initMineLag();
    } else if (viewId === "nytt-lag") {
        initNyttLag();
    } else if (viewId === "lag-detaljer") {
        initLagDetaljer();
    } else if (viewId === "ny-spiller") {
        initNySpiller();
    } else if (viewId === "rediger-spiller") {
        initRedigerSpiller();
    } else if (viewId === "rediger-lag") {
        initRedigerLag();
    } else if (viewId === "kamp-rapport") {
        initKampRapport();
    } else if (viewId === "historikk") {
        initHistorikk();
    }
}


// ==============================
// App boot
// ==============================

document.addEventListener("DOMContentLoaded", () => {
    const screenBg = document.querySelector(".screen-bg");
    screenBg.classList.add("bg-home");
});
