export function createClock(halfDurationSeconds) {
    const halfDuration = halfDurationSeconds;

    let currentHalf = 1;
    let running = false;
    let hasStarted = false;          // ✅ NEW (internal only)

    let halfStartTimestamp = null;   // ms since epoch
    let elapsedSeconds = 0;

    function start() {
        if (running) return;

        hasStarted = true;           // ✅ half now officially started
        running = true;

        halfStartTimestamp = Date.now();
    }

    function pause() {
        if (!running) return;

        elapsedSeconds = getElapsedSeconds();
        running = false;
        halfStartTimestamp = null;
    }

    function resetForNextHalf() {
        currentHalf += 1;
        running = false;
        hasStarted = false;          // ✅ next half has not started yet
        halfStartTimestamp = null;
        elapsedSeconds = 0;
    }

    function resetGame() {
        currentHalf = 1;
        running = false;
        hasStarted = false;          // ✅ reset start state
        halfStartTimestamp = null;
        elapsedSeconds = 0;
    }

    function getRemainingSeconds() {
        return Math.max(0, halfDuration - Math.min(getElapsedSeconds(), halfDuration));
    }

    function getElapsedSeconds() {
        if (!running) {
            return elapsedSeconds;
        }

        const liveElapsed = Math.floor((Date.now() - halfStartTimestamp) / 1000);
        return elapsedSeconds + liveElapsed;
    }

    function getAddedSeconds() {
        return Math.max(0, getElapsedSeconds() - halfDuration);
    }

    function isInAddedTime() {
        return hasStarted && getElapsedSeconds() >= halfDuration;
    }
    
    function isExpired() {
        return isInAddedTime();
    }

    function isRunning() {
        return running;
    }

    function getCurrentHalf() {
        return currentHalf;
    }

    function tick() {
        // no-op (timestamp-based)
    }

    function hydrate(state = {}) {
        const nextHalfRaw = Number(state.currentHalf);
        const nextElapsedRaw = Number(state.elapsedSeconds);

        currentHalf = Number.isFinite(nextHalfRaw) && nextHalfRaw > 0
            ? Math.floor(nextHalfRaw)
            : 1;
        elapsedSeconds = Number.isFinite(nextElapsedRaw) && nextElapsedRaw >= 0
            ? Math.floor(nextElapsedRaw)
            : 0;

        running = Boolean(state.running);
        hasStarted = Boolean(state.hasStarted) || elapsedSeconds > 0;
        halfStartTimestamp = running ? Date.now() : null;
    }

    
    


    return {
        start,
        pause,
        tick,
        resetForNextHalf,
        resetGame,
        getRemainingSeconds,
        getElapsedSeconds,
        getAddedSeconds,
        getCurrentHalf,
        isRunning,
        isInAddedTime,
        isExpired,
        hydrate
    };
}
