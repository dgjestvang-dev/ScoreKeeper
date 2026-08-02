import { buildMatchSummaryParts } from "./start-kamp.js";
import { apiUrl } from "../../config/api.js";

function toPlayerLabel(playerId, playersById) {
    if (!playerId) return "(Ukjent spiller)";

    const player = playersById.get(Number(playerId)) || playersById.get(playerId);
    if (!player) return "(Ikke angitt spiller)";

    return `#${player.shirt_number ?? "?"} ${player.name}`;
}

function count(events, type, team, half = null) {
    return events.filter(e =>
        e.type === type &&
        e.team === team &&
        (half === null || e.half === half)
    ).length;
}

function formatStatLine(events, label, type) {
    const homeFull = count(events, type, "home");
    const awayFull = count(events, type, "away");
    const homeHT = count(events, type, "home", 1);
    const awayHT = count(events, type, "away", 1);
    return `${label}: ${homeFull} – ${awayFull} (HT: ${homeHT} – ${awayHT})`;
}

function toDisplayMinute(event, halfDurationMinutes) {
    const minuteInHalfRaw = Number(event?.minute);
    const minuteInHalf = Number.isFinite(minuteInHalfRaw) && minuteInHalfRaw > 0
        ? Math.floor(minuteInHalfRaw)
        : 1;

    const halfRaw = Number(event?.half);
    const half = Number.isFinite(halfRaw) && halfRaw > 0
        ? Math.floor(halfRaw)
        : 1;

    if (!Number.isFinite(halfDurationMinutes) || halfDurationMinutes <= 0) {
        return minuteInHalf;
    }

    return minuteInHalf + ((half - 1) * halfDurationMinutes);
}

function formatDisplayMinute(event, halfDurationMinutes) {
    const minute = toDisplayMinute(event, halfDurationMinutes);
    const stoppage = Boolean(event?.stoppage_time);

    if (!stoppage || !Number.isFinite(halfDurationMinutes) || halfDurationMinutes <= 0) {
        return `${minute}'`;
    }

    const safeHalf = Number.isFinite(Number(event?.half)) && Number(event.half) > 0
        ? Math.floor(Number(event.half))
        : 1;
    const minuteInHalfRaw = Number(event?.minute);
    const minuteInHalf = Number.isFinite(minuteInHalfRaw) && minuteInHalfRaw > 0
        ? Math.floor(minuteInHalfRaw)
        : 1;
    const baseMinute = safeHalf * halfDurationMinutes;
    const addedMinute = Math.max(1, minuteInHalf - halfDurationMinutes);

    return `${baseMinute}+${addedMinute}'`;
}

function buildChronologicalTimeline(events, playersById, halfDurationMinutes) {
    const timelineEvents = events
        .filter(e => e.type === "goals" || e.type === "yellow_card" || e.type === "red_card")
        .sort((a, b) => {
            if ((a.half ?? 0) !== (b.half ?? 0)) return (a.half ?? 0) - (b.half ?? 0);
            if ((a.minute ?? 0) !== (b.minute ?? 0)) return (a.minute ?? 0) - (b.minute ?? 0);
            return (a.timestamp ?? 0) - (b.timestamp ?? 0);
        });

    const timeline = [];
    let homeGoals = 0;
    let awayGoals = 0;
    let currentHalf = null;

    for (const event of timelineEvents) {
        if (currentHalf !== null && event.half !== currentHalf) {
            timeline.push({ kind: "pause" });
        }
        currentHalf = event.half;

        if (event.type === "goals") {
            if (event.team === "home") {
                homeGoals++;
            } else {
                awayGoals++;
            }

            const assist = events.find(e =>
                e.type === "assists" &&
                e.team === event.team &&
                e.half === event.half &&
                e.minute === event.minute &&
                e.timestamp === event.timestamp
            );

            timeline.push({
                kind: "goal",
                minute: formatDisplayMinute(event, halfDurationMinutes),
                score: `${homeGoals}–${awayGoals}`,
                player: toPlayerLabel(event.player_id, playersById),
                assist: assist ? `(${toPlayerLabel(assist.player_id, playersById)})` : ""
            });
            continue;
        }

        timeline.push({
            kind: "card",
            icon: event.type === "red_card" ? "🟥" : "🟨",
            minute: formatDisplayMinute(event, halfDurationMinutes),
            player: toPlayerLabel(event.player_id, playersById)
        });
    }

    return timeline;
}

function formatGoals(events, playersById, halfDurationMinutes) {
    const goals = events
        .filter(e => e.type === "goals")
        .sort((a, b) => {
            if ((a.half ?? 0) !== (b.half ?? 0)) return (a.half ?? 0) - (b.half ?? 0);
            if ((a.minute ?? 0) !== (b.minute ?? 0)) return (a.minute ?? 0) - (b.minute ?? 0);
            return (a.timestamp ?? 0) - (b.timestamp ?? 0);
        });

    if (goals.length === 0) return ["Ingen mål"];

    let homeGoals = 0;
    let awayGoals = 0;
    let currentHalf = goals[0].half;
    const lines = [];

    for (const goal of goals) {
        if (goal.half !== currentHalf) {
            lines.push("-------- Pause --------");
            currentHalf = goal.half;
        }

        if (goal.team === "home") {
            homeGoals++;
        } else {
            awayGoals++;
        }

        const assist = events.find(e =>
            e.type === "assists" &&
            e.team === goal.team &&
            e.half === goal.half &&
            e.minute === goal.minute &&
            e.timestamp === goal.timestamp
        );

        const minuteText = formatDisplayMinute(goal, halfDurationMinutes);
        const scoreText = `${homeGoals}–${awayGoals}`;
        const playerText = toPlayerLabel(goal.player_id, playersById);
        const assistText = assist ? ` (${toPlayerLabel(assist.player_id, playersById)})` : "";

        lines.push(`${minuteText}   ${scoreText}   ${playerText}${assistText}`);
    }

    return lines;
}

function formatCards(events, playersById, halfDurationMinutes) {
    const cards = events
        .filter(e => e.type === "yellow_card" || e.type === "red_card")
        .sort((a, b) => {
            if ((a.half ?? 0) !== (b.half ?? 0)) return (a.half ?? 0) - (b.half ?? 0);
            if ((a.minute ?? 0) !== (b.minute ?? 0)) return (a.minute ?? 0) - (b.minute ?? 0);
            return (a.timestamp ?? 0) - (b.timestamp ?? 0);
        });

    if (cards.length === 0) return ["Ingen kort"];

    return cards.map(card => {
        const symbol = card.type === "red_card" ? "🟥" : "🟨";
        return `${formatDisplayMinute(card, halfDurationMinutes)}   ${symbol}   ${toPlayerLabel(card.player_id, playersById)}`;
    });
}

function buildSnapshotFromBackend(match, events, playersById) {
    const homeFT = count(events, "goals", "home");
    const awayFT = count(events, "goals", "away");
    const homeHT = count(events, "goals", "home", 1);
    const awayHT = count(events, "goals", "away", 1);

    const rawHalfDuration = Number(match?.half_duration_minutes);
    const halfDurationMinutes = Number.isFinite(rawHalfDuration) && rawHalfDuration > 0
        ? Math.floor(rawHalfDuration)
        : null;

    return {
        header: `${match.home_team_name} - ${match.away_team_name}: ${homeFT} – ${awayFT}  (HT: ${homeHT} – ${awayHT})`,
        timeline: buildChronologicalTimeline(events, playersById, halfDurationMinutes),
        events: formatGoals(events, playersById, halfDurationMinutes),
        cards: formatCards(events, playersById, halfDurationMinutes),
        stats: [
            formatStatLine(events, "Avslutninger", "shots_total"),
            formatStatLine(events, "Skudd på mål", "shots_target"),
            formatStatLine(events, "Corner", "corners"),
            formatStatLine(events, "Offside", "offside"),
            formatStatLine(events, "Gult kort", "yellow_card"),
            formatStatLine(events, "Rødt kort", "red_card")
        ]
    };
}

async function loadSelectedMatchFromBackend(matchId) {
    const [matchesRes, eventsRes, playersRes] = await Promise.all([
        fetch(apiUrl("/matches")),
        fetch(apiUrl("/events")),
        fetch(apiUrl("/players"))
    ]);

    if (!matchesRes.ok || !eventsRes.ok) {
        throw new Error("Kunne ikke hente kamp fra backend");
    }

    const matches = await matchesRes.json();
    const events = await eventsRes.json();
    let players = [];
    try {
        if (playersRes.ok) {
            players = await playersRes.json();
        }
    } catch {
        players = [];
    }

    const match = matches.find(m => Number(m.id) === Number(matchId));
    if (!match) {
        throw new Error("Fant ikke valgt kamp i backend");
    }

    const eventsForMatch = events.filter(e => Number(e.match_id) === Number(match.id));
    const playersById = new Map(players.map(p => [Number(p.id), p]));

    return buildSnapshotFromBackend(match, eventsForMatch, playersById);
}

export async function initKampRapport() {

    const summaryEl = document.getElementById("report-summary");
    const eventsEl = document.getElementById("report-events");
    const statsEl = document.getElementById("report-stats");
    const exportBtn = document.getElementById("export-report-btn");

    
    
    let data;

    const selectedMatchId = window.__selectedMatchId;
    const selectedMatchData = window.__selectedMatchData;

    if (selectedMatchId) {
        try {
            data = await loadSelectedMatchFromBackend(selectedMatchId);
        } catch (error) {
            console.error("Klarte ikke å laste kamp fra backend", error);
        }
    }

    if (!data && selectedMatchData) {
        data = selectedMatchData;
    }

    if (!data) {
        data = buildMatchSummaryParts();
    }




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


let homeScore = "";
let awayScore = "";

if (score.includes("–")) {
    [homeScore, awayScore] = score.split("–").map(s => s.trim());
}


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

if (Array.isArray(data.timeline) && data.timeline.length > 0) {
    data.timeline.forEach(item => {
        if (item.kind === "pause") {
            const row = document.createElement("div");
            row.classList.add("event-row", "pause");

            const text = document.createElement("span");
            text.textContent = "— Pause —";

            row.append(text);
            eventsEl.appendChild(row);
            return;
        }

        if (item.kind === "goal") {
            const row = document.createElement("div");
            row.classList.add("event-row", "goal");

            const icon = document.createElement("span");
            icon.textContent = "⚽";

            const minuteEl = document.createElement("span");
            minuteEl.textContent = item.minute;

            const scoreEl = document.createElement("span");
            scoreEl.textContent = item.score;

            const playerEl = document.createElement("span");
            playerEl.textContent = item.player;

            const assistEl = document.createElement("span");
            assistEl.textContent = item.assist || "";
            assistEl.classList.add("assist");

            row.append(icon, minuteEl, scoreEl, playerEl, assistEl);
            eventsEl.appendChild(row);
            return;
        }

        if (item.kind === "card") {
            const row = document.createElement("div");
            row.classList.add("event-row", "card");

            const icon = document.createElement("span");
            icon.textContent = item.icon;

            const minuteEl = document.createElement("span");
            minuteEl.textContent = item.minute;

            const emptyScore = document.createElement("span");
            emptyScore.textContent = "";

            const playerEl = document.createElement("span");
            playerEl.textContent = item.player;

            const spacer = document.createElement("span");

            row.append(icon, minuteEl, emptyScore, playerEl, spacer);
            eventsEl.appendChild(row);
        }
    });
} else {

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
}



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

    const reportEl = document.querySelector(".report-view");
    const originalScrollTop = reportEl.scrollTop;

    // ✅ finn actions (knappene nederst)
    const actions = reportEl.querySelector(".actions-row");
    const originalDisplay = actions.style.display;

    // ✅ lagre original bakgrunn og padding
    const originalBackground = reportEl.style.background;
    const originalPadding = reportEl.style.padding;

    // ✅ skjul knapper
    actions.style.display = "none";

    // ✅ legg på gradient (samme som app)
    reportEl.style.background = "linear-gradient(180deg, #FFEADF 0%, #FF9B63 100%)";

    // ✅ litt ekstra luft rundt
    reportEl.style.padding = "20px";

    // ✅ sørg for at hele innholdet rendres, ikke bare synlig viewport
    const originalHeight = reportEl.style.height;
    const originalOverflow = reportEl.style.overflow;
    const originalMaxHeight = reportEl.style.maxHeight;
    const clientWidth = reportEl.clientWidth;
    const fullHeight = reportEl.scrollHeight;

    reportEl.style.height = `${fullHeight}px`;
    reportEl.style.maxHeight = "none";
    reportEl.style.overflow = "visible";

    try {
        const canvas = await html2canvas(reportEl, {
            scale: 2,
            useCORS: true,
            backgroundColor: null,
            scrollY: 0,
            windowWidth: clientWidth,
            windowHeight: fullHeight,
            height: fullHeight,
            width: clientWidth,
            onclone: (clonedDoc) => {
                const clonedReport = clonedDoc.querySelector(".report-view");
                if (!clonedReport) return;

                const hideScrollbarsStyle = clonedDoc.createElement("style");
                hideScrollbarsStyle.textContent = `
                    .report-view {
                        scrollbar-width: none !important;
                        -ms-overflow-style: none !important;
                    }

                    .report-view::-webkit-scrollbar {
                        width: 0 !important;
                        height: 0 !important;
                        display: none !important;
                    }
                `;
                clonedDoc.head.appendChild(hideScrollbarsStyle);

                clonedReport.style.height = `${fullHeight}px`;
                clonedReport.style.maxHeight = "none";
                clonedReport.style.overflow = "hidden";
                clonedReport.style.overflowY = "hidden";
                clonedReport.style.position = "relative";
                clonedReport.style.inset = "auto";
                clonedReport.style.transform = "none";
                clonedReport.style.width = `${clientWidth}px`;
                clonedReport.style.boxSizing = "border-box";

                const clonedActions = clonedReport.querySelector(".actions-row");
                if (clonedActions) {
                    clonedActions.style.position = "static";
                    clonedActions.style.bottom = "auto";
                    clonedActions.style.background = "transparent";
                    clonedActions.style.boxShadow = "none";
                    clonedActions.style.borderTop = "none";
                }
            }
        });

        const imgData = canvas.toDataURL("image/png");

        // ✅ reset visning
        actions.style.display = originalDisplay;
        reportEl.style.background = originalBackground;
        reportEl.style.padding = originalPadding;
        reportEl.style.height = originalHeight;
        reportEl.style.maxHeight = originalMaxHeight;
        reportEl.style.overflow = originalOverflow;
        reportEl.scrollTop = originalScrollTop;

        // ✅ DELING (mobil)
        if (navigator.share) {
            const blob = await (await fetch(imgData)).blob();

            await navigator.share({
                files: [
                    new File([blob], "kamp-rapport.png", {
                        type: "image/png"
                    })
                ]
            });

            return;
        }

        // ✅ fallback → download
        const link = document.createElement("a");
        link.href = imgData;
        link.download = "kamp-rapport.png";
        link.click();

    } catch (err) {
        console.error(err);
        alert("Kunne ikke lage bilde");

        // ✅ reset også ved feil
        actions.style.display = originalDisplay;
        reportEl.style.background = originalBackground;
        reportEl.style.padding = originalPadding;
        reportEl.style.height = originalHeight;
        reportEl.style.maxHeight = originalMaxHeight;
        reportEl.style.overflow = originalOverflow;
        reportEl.scrollTop = originalScrollTop;
    }
});



}

