// ==============================
// Navigation state
// ==============================

const historyStack = [];


// ==============================
// Global click handler
// ==============================

document.addEventListener("click", (event) => {

    // Forward navigation (data-nav)
    const navTarget = event.target.closest("[data-nav]");
    if (navTarget) {
        navigateTo(navTarget.dataset.nav);
        return;
    }

    // Back navigation (data-back)
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
// Replace navigation (DONE)
// ==============================

export function navigateToReplacingCurrent(id) {
    const current = document.querySelector(".view.active");
    const next = document.getElementById(id);

    if (!next || next === current) return;

    // ✅ Replace = fjern siste historikk‑entry
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

import { initKampdag } from "./kampdag.js";
import { initStartKamp } from "./start-kamp.js";
import { initMineLag } from "./mine-lag.js";
import { initNyttLag } from "./nytt-lag.js";
import { initLagDetaljer } from "./lagdetaljer.js";
import { initNySpiller } from "./ny-spiller.js";
import { initRedigerSpiller } from "./rediger-spiller.js";
import { initRedigerLag } from "./rediger-lag.js";
import { initKampRapport } from "./kamp-rapport.js";
import { initHistorikk } from "./historikk.js";

function activateView(viewId) {
    const screenBg = document.querySelector(".screen-bg");

    // Reset background
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