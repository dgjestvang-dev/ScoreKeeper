
import { matchConfig } from "./match-config.js";

let startMatchBtn;
let gametimeInput;
let hometeamInput;
let awayteamInput;

export function initKampdag() {
    startMatchBtn = document.querySelector('#kampdag [data-nav="start-kamp"]');
    gametimeInput = document.getElementById("gametime");
    hometeamInput = document.getElementById("hometeam");
    awayteamInput = document.getElementById("awayteam");

    // ✅ FIXED variable name here
    if (!startMatchBtn || !gametimeInput || !hometeamInput || !awayteamInput) {
        console.error("Kampdag elements not found");
        return;
    }

    startMatchBtn.addEventListener("click", onStartMatchClick);
}

function onStartMatchClick() {
    const minutes = Number(gametimeInput.value);
    const homeName = hometeamInput.value.trim();
    const awayName = awayteamInput.value.trim();

    if (!minutes || minutes <= 0) {
        alert("Ugyldig omgangstid");
        return;
    }

    if (!homeName) {
        alert("Hjemmelag mangler");
        return;
    }

    if (!awayName) {
        alert("Bortelag mangler");
        return;
    }

    matchConfig.gametimeMinutes = minutes;
    matchConfig.homeTeamName = homeName;
    matchConfig.awayTeamName = awayName;
}
