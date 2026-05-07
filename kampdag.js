
import { getTeams } from "./teams.js";
import { matchConfig } from "./match-config.js";


let startMatchBtn;
let gametimeInput;
let homeSelect;
let awaySelect;




export function initKampdag() {
    startMatchBtn = document.querySelector('#kampdag [data-nav="start-kamp"]');
    gametimeInput = document.getElementById("gametime");
    homeSelect = document.getElementById("home-team");
    awaySelect = document.getElementById("away-team");

    if (!startMatchBtn || !gametimeInput || !homeSelect || !awaySelect) {
        console.error("Kampdag elements not found");
        return;
    }

    populateTeamSelects(); // ← DENNE ER KRITISK

    startMatchBtn.addEventListener("click", onStartMatchClick);
}

function populateTeamSelects() {
    const teams = getTeams();

    console.log("populateTeamSelects teams:", teams);

    homeSelect.innerHTML = "";
    awaySelect.innerHTML = "";

    Object.values(teams).forEach(team => {
        const homeOption = document.createElement("option");
        homeOption.value = team.id;
        homeOption.textContent = team.name;
        homeSelect.appendChild(homeOption);

        const awayOption = document.createElement("option");
        awayOption.value = team.id;
        awayOption.textContent = team.name;
        awaySelect.appendChild(awayOption);
    });
}


function onStartMatchClick() {
    const minutes = Number(gametimeInput.value);
    const homeTeamId = homeSelect.value;
    const awayTeamId = awaySelect.value;

    if (!minutes || minutes <= 0) {
        alert("Ugyldig omgangstid");
        return;
    }

    if (!homeTeamId) {
        alert("Velg hjemmelag");
        return;
    }

    if (!awayTeamId) {
        alert("Velg bortelag");
        return;
    }

    if (homeTeamId === awayTeamId) {
        alert("Hjemmelag og bortelag kan ikke være samme lag");
        return;
    }

    const teams = getTeams();

    matchConfig.gametimeMinutes = minutes;
    matchConfig.homeTeamId = homeTeamId;
    matchConfig.awayTeamId = awayTeamId;
    matchConfig.homeTeamName = teams[homeTeamId].name;
    matchConfig.awayTeamName = teams[awayTeamId].name;

    // ✅ DEBUG – behold til alt er verifisert
    console.log("Starter kamp med:", matchConfig);

    
}

