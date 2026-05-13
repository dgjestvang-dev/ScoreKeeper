import { buildMatchSummaryParts } from "./start-kamp.js";

export function initKampRapport() {

    const summaryEl = document.getElementById("report-summary");
    const eventsEl = document.getElementById("report-events");
    const statsEl = document.getElementById("report-stats");
    const exportBtn = document.getElementById("export-report-btn");

    const data = buildMatchSummaryParts();

    // 🔍 parse header
// "Frisk Asker G13 - teb: 2 – 1  (HT: 1 – 0)"


const header = data.header;

// ✅ finn første kolon KUN
const firstColon = header.indexOf(":");

// lagdel
const teamsPart = header.substring(0, firstColon);
const [homeName, awayName] = teamsPart.split(" - ");

// resten (score + HT)
const scorePart = header.substring(firstColon + 1).trim();

// score (3 – 1)
const scoreMatch = scorePart.match(/\d+\s–\s\d+/);
const score = scoreMatch ? scoreMatch[0] : "";

// HT riktig hentet ✅
const htMatch = scorePart.match(/\(HT:\s*(.*?)\)/);
const ht = htMatch ? htMatch[1] : "";


// bygg UI
summaryEl.innerHTML = "";

const row = document.createElement("div");
row.classList.add("scoreboard");

const homeEl = document.createElement("span");
homeEl.classList.add("team");
homeEl.textContent = homeName;

const scoreEl = document.createElement("span");

const [homeScore, awayScore] = score.split("–").map(s => s.trim());

// bygg struktur
scoreEl.innerHTML = `
    <span class="score-num">${homeScore}</span>
    <span class="score-sep">–</span>
    <span class="score-num">${awayScore}</span>
`;


const awayEl = document.createElement("span");
awayEl.classList.add("team");
awayEl.textContent = awayName;

row.append(homeEl, scoreEl, awayEl);

// HT
const htEl = document.createElement("div");
htEl.classList.add("halftime");
htEl.textContent = ht ? `(${ht})` : "";

summaryEl.append(row, htEl);


// ✅ EVENTS (mål + kort)
eventsEl.innerHTML = "";

// ─────────────────
// MÅL (kolonner)
// ─────────────────

    data.events.forEach(line => {
        if (!line.trim()) return;

        if (line.includes("Pause")) {
            const row = document.createElement("div");
            row.classList.add("event-row", "pause");
            row.style.display = "block";


            const text = document.createElement("span");
            text.textContent = "— Pause —";

            row.append(text);
            eventsEl.appendChild(row);
            return; 
        }


    const row = document.createElement("div");
    row.classList.add("event-row", "goal");

    // 🔍 Split line:
    // Eksempel:
    // "1'   2–1   #18 Liam (#17 Hugo)"

    const parts = line.split(/\s{2,}|\t+/);

    const minute = parts[0] || "";
    const score = parts[1] || "";
    const playerPart = parts.slice(2).join(" ");

    // spiller + assist
    const assistMatch = playerPart.match(/\((.*?)\)/);

    const player = playerPart.replace(/\(.*\)/, "").trim();
    const assist = assistMatch ? `(${assistMatch[1]})` : "";

    // ✅ bygg UI

    const icon = document.createElement("span");
    icon.textContent = "⚽";

    const minuteEl = document.createElement("span");
    minuteEl.textContent = minute;

    const scoreEl = document.createElement("span");
    scoreEl.textContent = score;

    const playerEl = document.createElement("span");
    playerEl.textContent = player;

    const assistEl = document.createElement("span");
    assistEl.textContent = assist;
    assistEl.classList.add("assist");

    row.append(icon, minuteEl, scoreEl, playerEl, assistEl);
    eventsEl.appendChild(row);
});

// ─────────────────
// KORT (enkel visning)
// ─────────────────

data.cards.forEach(line => {
    if (!line.trim()) return;

    const row = document.createElement("div");
    row.classList.add("event-row", "card");

    // finn ikon
    const icon = document.createElement("span");
    icon.textContent = line.includes("🟥") ? "🟥" : "🟨";

    // fjern ikon fra tekst
    const cleanLine = line.replace("🟨", "").replace("🟥", "").trim();

    // parse minutt
    const minuteMatch = cleanLine.match(/^(\d+['’])/);
    const minute = minuteMatch ? minuteMatch[1] : "";

    // parse spiller
    const playerMatch = cleanLine.match(/#\d+\s.*$/);
    const player = playerMatch ? playerMatch[0] : cleanLine;

    // bygg kolonner
    const minuteEl = document.createElement("span");
    minuteEl.textContent = minute;

    const emptyScore = document.createElement("span");
    emptyScore.textContent = ""; // ingen score for kort

    const playerEl = document.createElement("span");
    playerEl.textContent = player;

    const spacer = document.createElement("span");

    row.append(icon, minuteEl, emptyScore, playerEl, spacer);
    eventsEl.appendChild(row);
});



// ─────────────────
// STATISTIKK (strukturert)
// ─────────────────
statsEl.innerHTML = "";

data.stats.forEach(line => {
    if (!line || !line.trim()) return;

    const row = document.createElement("div");
    row.classList.add("stat-row");

    // ✅ SPLITT KORREKT (kun første kolon)
    const firstColon = line.indexOf(":");
    const label = line.substring(0, firstColon);
    const rest = line.substring(firstColon + 1).trim();

    // ✅ trekk ut FULL og HT
    let full = rest;
    let ht = "";

    const htStart = rest.indexOf("(HT:");
    if (htStart !== -1) {
        full = rest.substring(0, htStart).trim();
        ht = rest.substring(htStart + 4).replace(")", "").trim();
    }

    // ✅ split score
    const [homeFull, awayFull] = full.split("–").map(s => s.trim());
    const [homeHT, awayHT] = ht ? ht.split("–").map(s => s.trim()) : ["", ""];

    // ───── LABEL
    const labelEl = document.createElement("span");
    labelEl.classList.add("stat-label");
    labelEl.textContent = label;

    // ───── FULL (FT)
    const fullEl = document.createElement("span");
    fullEl.classList.add("stat-score");
    fullEl.textContent = `${homeFull} | ${awayFull}`;

    // ✅ 🔥 HIGHLIGHT LOGIKK (HER VAR DET DU SPURTE OM)
    if (Number(homeFull) > Number(awayFull)) {
        fullEl.classList.add("home-leading");
    } else if (Number(awayFull) > Number(homeFull)) {
        fullEl.classList.add("away-leading");
    }

    // ───── HT
    const htEl = document.createElement("span");
    htEl.classList.add("stat-ht");
    htEl.textContent = ht ? `(${homeHT} | ${awayHT})` : "";

    row.append(labelEl, fullEl, htEl);
    statsEl.appendChild(row);
});





   exportBtn.addEventListener("click", async () => {
    try {

        // 🔥 bygg pen tekst
        const reportText = [
            data.header,
            "",
            "KAMPHENDELSER\n-----------",
            ...data.events,
            "",
            ...data.cards,
            "",
            "STATISTIKK\n-----------",
            ...data.stats
        ].join("\n");

        await navigator.clipboard.writeText(reportText);

        alert("Kamprapport kopiert 👍");

    } catch (err) {
        console.error(err);
        alert("Kunne ikke kopiere");
    }
});

}
