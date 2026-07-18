import { getTeams, rehydrateTeamsFromBackend } from "../../core/teams.js";
import { matchConfig } from "../../config/match-config.js";

let startMatchBtn;
let gametimeInput;
let homeInput;
let awayInput;

export async function initKampdag() {
    startMatchBtn = document.querySelector('#kampdag [data-nav="start-kamp"]');
    gametimeInput = document.getElementById("gametime");
    homeInput = document.getElementById("home-team");
    awayInput = document.getElementById("away-team");

    if (!startMatchBtn || !gametimeInput || !homeInput || !awayInput) {
        console.error("Kampdag elements not found");
        return;
    }

    await populateTeamOptions();
    startMatchBtn.addEventListener("click", onStartMatchClick);
}

async function populateTeamOptions() {
    const teamOptions = document.getElementById("team-options");

    if (!teamOptions) {
        console.error("team-options datalist not found");
        return;
    }

    teamOptions.innerHTML = "";
    await rehydrateTeamsFromBackend();

    const teams = getTeams();
    Object.values(teams).forEach(team => {
        const option = document.createElement("option");
        option.value = team.name;
        teamOptions.appendChild(option);
    });

    setTimeout(() => {
        const dateInput = document.getElementById("match-date");
        if (dateInput && !dateInput.value) {
            const today = new Date();
            dateInput.value = today.toISOString().split("T")[0];
        }
    }, 0);
}

function onStartMatchClick() {
    const minutes = Number(gametimeInput.value);
    const homeTeamName = homeInput.value.trim();
    const awayTeamName = awayInput.value.trim();

    if (!minutes || minutes <= 0) {
        alert("Ugyldig omgangstid");
        return;
    }

    if (!homeTeamName) {
        alert("Skriv inn hjemmelag");
        return;
    }

    if (!awayTeamName) {
        alert("Skriv inn bortelag");
        return;
    }

    if (homeTeamName.toLowerCase() === awayTeamName.toLowerCase()) {
        alert("Lagene kan ikke være samme");
        return;
    }

    matchConfig.gametimeMinutes = minutes;
    matchConfig.homeTeamName = homeTeamName;
    matchConfig.awayTeamName = awayTeamName;

    const teams = getTeams();
    const homeMatch = Object.values(teams).find(t =>
        t.name.toLowerCase() === homeTeamName.toLowerCase()
    );
    const awayMatch = Object.values(teams).find(t =>
        t.name.toLowerCase() === awayTeamName.toLowerCase()
    );

    matchConfig.homeTeamId = homeMatch ? homeMatch.id : null;
    matchConfig.awayTeamId = awayMatch ? awayMatch.id : null;
}
