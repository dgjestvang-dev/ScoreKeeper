import { getTeams } from "./teams.js";
import { setSelectedTeam } from "./team-selection.js";

let teamListEl;
let createTeamBtn;

export function initMineLag() {
    teamListEl = document.getElementById("team-list");
    createTeamBtn = document.getElementById("create-team-btn");

    if (!teamListEl || !createTeamBtn) {
        console.error("Mine lag: DOM‑elementer ikke funnet");
        return;
    }

    renderTeamList();

}

function renderTeamList() {
    const teams = getTeams();
    const teamArray = Object.values(teams);

    teamListEl.innerHTML = "";

    if (teamArray.length === 0) {
        const li = document.createElement("li");
        li.textContent = "Ingen lag opprettet enda";
        li.className = "empty";
        teamListEl.appendChild(li);
        return;
    }

    teamArray.forEach(team => {
        const li = document.createElement("li");
        li.className = "team-item";
        li.textContent = team.name;

    li.dataset.nav = "lag-detaljer";    
    
    li.addEventListener("click", () => {
        setSelectedTeam(team.id);
    });



        teamListEl.appendChild(li);
    });
}
``