import { getActiveUser, logoutUser } from "./login.js";
import { navigateToReplacingCurrent } from "../navigation.js";

let menuTriggerBtn;
let menuDropdown;
let initialsEl;
let nameEl;
let usernameEl;
let infoBtn;
let logoutBtn;
let outsideClickHandler = null;

function getInitials(user) {
    const firstName = (user?.first_name || "").trim();
    const lastName = (user?.last_name || "").trim();

    if (firstName || lastName) {
        return `${(firstName[0] || "").toUpperCase()}${(lastName[0] || "").toUpperCase()}` || "?";
    }

    const username = (user?.username || "").trim();
    return username.slice(0, 2).toUpperCase() || "?";
}

function getDisplayName(user) {
    const fullName = `${(user?.first_name || "").trim()} ${(user?.last_name || "").trim()}`.trim();
    if (fullName) return fullName;
    return user?.display_name || user?.username || "Ukjent bruker";
}

export function initMainMenu() {
    menuTriggerBtn = document.getElementById("user-menu-trigger");
    menuDropdown = document.getElementById("user-menu-dropdown");
    initialsEl = document.getElementById("user-avatar-initials");
    nameEl = document.getElementById("user-menu-name");
    usernameEl = document.getElementById("user-menu-username");
    infoBtn = document.getElementById("user-menu-info-btn");
    logoutBtn = document.getElementById("user-menu-logout-btn");

    if (!menuTriggerBtn || !menuDropdown || !initialsEl || !nameEl || !usernameEl || !infoBtn || !logoutBtn) {
        console.error("Main menu: user menu elements not found");
        return;
    }

    const user = getActiveUser();
    const username = user?.username || "ukjent";

    initialsEl.textContent = getInitials(user);
    nameEl.textContent = getDisplayName(user);
    usernameEl.textContent = `@${username}`;

    menuDropdown.classList.add("hidden");

    menuTriggerBtn.onclick = (event) => {
        event.stopPropagation();
        menuDropdown.classList.toggle("hidden");
    };

    infoBtn.onclick = () => {
        const infoText = `${getDisplayName(user)}\n@${username}`;
        alert(infoText);
        menuDropdown.classList.add("hidden");
    };

    logoutBtn.onclick = () => {
        logoutUser();
        menuDropdown.classList.add("hidden");
        navigateToReplacingCurrent("home");
    };

    if (outsideClickHandler) {
        document.removeEventListener("click", outsideClickHandler);
    }

    outsideClickHandler = (event) => {
        if (menuDropdown.classList.contains("hidden")) return;
        if (menuDropdown.contains(event.target) || menuTriggerBtn.contains(event.target)) return;
        menuDropdown.classList.add("hidden");
    };

    document.addEventListener("click", outsideClickHandler);
}
