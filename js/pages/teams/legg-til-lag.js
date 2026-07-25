import { joinTeamByCode } from "../../core/teams.js";
import { navigateToReplacingCurrent } from "../../navigation.js";

let joinInputEl;
let joinSubmitBtn;
let joinStatusEl;

export function initLeggTilLag() {
    joinInputEl = document.getElementById("join-team-code-input");
    joinSubmitBtn = document.getElementById("join-team-submit-btn");
    joinStatusEl = document.getElementById("join-team-status");

    if (!joinInputEl || !joinSubmitBtn || !joinStatusEl) {
        console.error("Legg til lag: DOM-elementer ikke funnet");
        return;
    }

    joinInputEl.value = "";
    joinStatusEl.textContent = "";

    joinSubmitBtn.onclick = async () => {
        const code = (joinInputEl.value || "").trim().toUpperCase();
        if (!code) {
            joinStatusEl.textContent = "Skriv inn en lagkode.";
            return;
        }

        joinSubmitBtn.disabled = true;
        joinStatusEl.textContent = "Legger til lag...";

        try {
            await joinTeamByCode(code);
            joinStatusEl.textContent = "Lag lagt til.";
            joinInputEl.value = "";
            navigateToReplacingCurrent("mine-lag");
        } catch (err) {
            console.error("Failed to join team", err);
            joinStatusEl.textContent = err.message || "Kunne ikke legge til laget.";
        } finally {
            joinSubmitBtn.disabled = false;
        }
    };
}
