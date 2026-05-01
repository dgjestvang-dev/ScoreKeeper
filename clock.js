export function createClock(halfDurationSeconds) {
    let halfDuration = halfDurationSeconds;

    let currentHalf = 1;
    let running = false;

    let halfStartTimestamp = null; // ms since epoch
    let pausedRemaining = halfDuration; // seconds

    function start() {
        if (running) return;

        running = true;

        // Resume from pause OR start new half
        halfStartTimestamp = Date.now() - (halfDuration - pausedRemaining) * 1000;
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
        halfStartTimestamp = null;
        pausedRemaining = halfDuration;
    }

    function resetGame() {
        currentHalf = 1;
        running = false;
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

        const remaining = halfDuration - elapsed;
        return Math.max(0, remaining);
    }

    function tick() {
        // No-op: time is derived from Date.now()
        // This function exists to preserve your existing API
    }

    function isExpired() {
        return getRemainingSeconds() <= 0;
    }

    function isRunning() {
        return running;
    }

    function getCurrentHalf() {
        return currentHalf;
    }

    return {
        start,
        pause,
        tick,
        resetForNextHalf,
        resetGame,
        getRemainingSeconds,
        getCurrentHalf,
        isRunning,
        isExpired
    };
}
``