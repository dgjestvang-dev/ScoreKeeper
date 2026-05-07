// ─────────────────────────────────────────────
// LocalStorage helpers
// Responsibility: safe JSON persistence
// ─────────────────────────────────────────────

export function loadFromStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
        console.warn("Failed to load from storage:", key, err);
        return fallback;
    }
}

export function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        console.warn("Failed to save to storage:", key, err);
    }
}