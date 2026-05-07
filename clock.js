export function createClock(halfDurationSeconds) {
    const halfDuration = halfDurationSeconds;

    let currentHalf = 1;
    let running = false;
    let hasStarted = false;          // ✅ NEW (internal only)

    let halfStartTimestamp = null;   // ms since epoch
    let pausedRemaining = halfDuration;

    function start() {
        if (running) return;

        hasStarted = true;           // ✅ half now officially started
        running = true;

        halfStartTimestamp =
            Date.now() - (halfDuration - pausedRemaining) * 1000;
    }

    function pause() {
        if (!running) return;

        pausedRemaining = getRemainingSeconds();
        running = false;
        halfStartTimestamp = null;
    }

    function resetForNextHalf() {
        currentHalf += 1;
        running = false;
        hasStarted = false;          // ✅ next half has not started yet
        halfStartTimestamp = null;
        pausedRemaining = halfDuration;
    }

    function resetGame() {
        currentHalf = 1;
        running = false;
        hasStarted = false;          // ✅ reset start state
        halfStartTimestamp = null;
        pausedRemaining = halfDuration;
    }

    function getRemainingSeconds() {
        if (!running) {
            return pausedRemaining;
        }

        const elapsed = Math.floor(
            (Date.now() - halfStartTimestamp) / 1000
        );

        return Math.max(0, halfDuration - elapsed);
    }

    function getElapsedSeconds() {
        return halfDuration - getRemainingSeconds();
    }
    
    function isExpired() {
        // ✅ EXPLICITLY require that the half was started
        return hasStarted && getRemainingSeconds() === 0;
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

    
    


    return {
        start,
        pause,
        tick,
        resetForNextHalf,
        resetGame,
        getRemainingSeconds,
        getElapsedSeconds,
        getCurrentHalf,
        isRunning,
        isExpired
    };
}