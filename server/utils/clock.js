/* 
Run clock for scoring v2 (slice 4): pure functions, no database, no real clock.
Times are milliseconds since the epoch. The caller passes "now", so tests never wait.

Active play time = finishedAt - startedAt - pausedMs (see activeSeconds in utils/finalScore.js).
This file decides how pausedMs grows.
*/
const PAUSE_RULES = {
    MAX_CREDIT_MS: 10 * 60 * 1000, // total pause time that can come off a run (one cap per run, not per pause)
};

const toMs = (v) => {
    if (v === null || v === undefined) return null;
    const ms = new Date(v).getTime();
    return Number.isFinite(ms) ? ms : null;
};

function clockFromSave(save) {
    return {
        startedAt: toMs(save?.startedAt),
        finishedAt: toMs(save?.finishedAt),
        pausedAt: toMs(save?.pausedAt),
        pausedMs: typeof save?.pausedMs === "number" && Number.isFinite(save.pausedMs) && save.pausedMs > 0 ? save.pausedMs : 0,
    };
}

function creditLeftMs(clock) {
    return Math.max(0, PAUSE_RULES.MAX_CREDIT_MS - clock.pausedMs);
}

function pauseClock(clock, nowMs) {
    if (clock.startedAt === null || clock.finishedAt !== null || clock.pausedAt !== null) {
        return { clock, changed: false };
    }
    return { clock: { ...clock, pausedAt: nowMs }, changed: true };
}

function settlePause(clock, nowMs) {
    if (clock.pausedAt === null) return { clock, changed: false };
    const elapsed = Math.max(0, nowMs - clock.pausedAt);
    const credit = Math.min(elapsed, creditLeftMs(clock));
    return { clock: { ...clock, pausedAt: null, pausedMs: clock.pausedMs + credit }, changed: true };
}

module.exports = { PAUSE_RULES, clockFromSave, creditLeftMs, pauseClock, settlePause };
