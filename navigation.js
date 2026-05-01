

const historyStack = [];

    // Handle navigation buttons
    document.addEventListener('click', (event) => {

        /* ---- DEBUG ----/*
        /*console.log( 
        'nav:', event.target.closest('[data-nav]')?.dataset.nav,
        'back:', !!event.target.closest('[data-back]')
        ); */

        // Forward navigation
        const navTarget = event.target.closest('[data-nav]');
        if (navTarget) {
            navigateTo(navTarget.dataset.nav);
            return;
        }

        
        // Back navigation
        const backButton = event.target.closest('[data-back]');
        if (backButton) {
            goBack();
        }
    });

    function navigateTo(id) {
    const current = document.querySelector('.view.active');
    const next = document.getElementById(id);

    if (!next || next === current) return;

    historyStack.push(current.id);

    current.classList.remove('active');
    next.classList.remove('back');
    next.classList.add('active');

    activateView(id);
    
}

    export function goBack() {
        if (historyStack.length === 0) return;

        const current = document.querySelector('.view.active');
        const previousId = historyStack.pop();
        const previous = document.getElementById(previousId);

        current.classList.remove('active');
        current.classList.add('back');
        previous.classList.add('active');

        activateView(previousId);
    }



import { initKampdag } from "./kampdag.js";
import { initStartKamp } from "./start-kamp.js";



function activateView(viewId) {
    const screenBg = document.querySelector(".screen-bg");

    // Reset all background states
    screenBg.classList.remove("bg-home", "bg-app");

    // Apply correct background
    if (viewId === "home") {
        screenBg.classList.add("bg-home");
    } else {
        screenBg.classList.add("bg-app");
    }

    // Existing view init logic
    if (viewId === "kampdag") {
        initKampdag();
    }

    if (viewId === "start-kamp") {
        initStartKamp();
    }
}



document.addEventListener("DOMContentLoaded", () => {
    const screenBg = document.querySelector(".screen-bg");
    screenBg.classList.add("bg-home");
});





