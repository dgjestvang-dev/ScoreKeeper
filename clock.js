/**
 * Passive game clock
 * ------------------
 * - Counts down
 * - Two halves
 * - No timers, no DOM, no side effects
 * - State changes only via explicit method calls
 */

export function createClock(halfDurationSeconds) {
    // --- Private state ---
    let currentHalf = 1;
    let remainingSeconds = halfDurationSeconds;
    let isRunning = false;

    // --- Public API ---
    return {
        // --- Read-only accessors ---
        getCurrentHalf() {
            return currentHalf;
        },

        getRemainingSeconds() {
            return remainingSeconds;
        },

        isRunning() {
            return isRunning;
        },

        isExpired() {
            return remainingSeconds === 0;
        },

        // --- Commands ---
        start() {
            if (remainingSeconds > 0) {
                isRunning = true;
            }
        },

        pause() {
            isRunning = false;
        },

        tick() {
            if (!isRunning || remainingSeconds === 0) {
                return;
            }

            remainingSeconds -= 1;

            if (remainingSeconds === 0) {
                isRunning = false;
            }
        },

        resetForNextHalf() {
            if (currentHalf === 1 && remainingSeconds === 0) {
                currentHalf = 2;
                remainingSeconds = halfDurationSeconds;
                isRunning = false;
            }
        },

        resetGame() {
            currentHalf = 1;
            remainingSeconds = halfDurationSeconds;
            isRunning = false;
        }
    };
}