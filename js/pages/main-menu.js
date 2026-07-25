import { logoutUser } from "./login.js";
import { navigateToReplacingCurrent } from "../navigation.js";

let logoutBtn;

export function initMainMenu() {
    logoutBtn = document.getElementById("logout-btn");

    if (!logoutBtn) {
        console.error("Main menu: logout button not found");
        return;
    }

    logoutBtn.onclick = () => {
        logoutUser();
        navigateToReplacingCurrent("home");
    };
}
