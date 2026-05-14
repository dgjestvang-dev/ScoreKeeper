import { loadFromStorage, saveToStorage } from "./storage.js";
import { navigateTo } from "./navigation.js";

export function initHistorikk() {
    const listEl = document.getElementById("history-list");

    const history = loadFromStorage("sk_match_history", []);

    listEl.innerHTML = "";

    if (history.length === 0) {
        listEl.textContent = "Ingen kamper lagret";
        return;
    }

    history
        .slice()
        .reverse()  // nyeste først
        .forEach(match => {
            const item = document.createElement("div");
            item.classList.add("history-item");

            const { header } = match.data;
            const cleanedHeader = header.replace(/\s*\(HT:.*?\)/, "");

            const date = new Date(match.date).toLocaleDateString();
            
            item.innerHTML = `
                <div class="history-main">
                    <div class="history-title">${cleanedHeader}</div>
                    <div class="history-date">${date}</div>
                </div>

                <button class="delete-btn">✕</button>
            `;

            item.addEventListener("click", () => {

                // ✅ lagre valgt kamp midlertidig
                localStorage.setItem(
                    "sk_selected_match",
                    JSON.stringify(match.data)
                );

                // ✅ naviger til rapport
                navigateTo("kamp-rapport");
            });

            const deleteBtn = item.querySelector(".delete-btn");

            deleteBtn.addEventListener("click", (event) => {
                event.stopPropagation(); // ❗ hindrer at klikk åpner kampen

                const confirmed = confirm("Slette denne kampen?");
                if (!confirmed) return;

                // hent oppdatert liste
                let history = loadFromStorage("sk_match_history", []);

                // fjern riktig kamp
                history = history.filter(m => m.id !== match.id);

                // lagre igjen
                saveToStorage("sk_match_history", history);

                // fjern fra UI
                item.remove();
            });
            

            listEl.appendChild(item);
        });
}
