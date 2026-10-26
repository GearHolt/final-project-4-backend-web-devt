// Final score (scoring v2, slice 3): pure functions, no database, no clock.
// The numbers for the time bonus and the goal bonus live in FINAL_RULES, in one place.
const { SCORE_RULES, stateFromSave } = require("./score");

const FINAL_RULES = {
    GOAL_BONUS: 500, // for unlocking the final file; never multiplied by time
    TIME_TIERS: [
        { maxSeconds: 120, multiplier: 1.5 },
        { maxSeconds: 300, multiplier: 1.3 },
        { maxSeconds: 600, multiplier: 1.15 },
        { maxSeconds: 1200, multiplier: 1.05 },
    ],
    SLOWEST_MULTIPLIER: 1.0,
};

// seconds = ACTIVE play time. Junk (NaN, undefined) gets the slowest tier, so bad data never helps a player.
function timeMultiplier(seconds) {
    if (!Number.isFinite(seconds)) return FINAL_RULES.SLOWEST_MULTIPLIER;
    for (const tier of FINAL_RULES.TIME_TIERS) {
        if (seconds <= tier.maxSeconds) return tier.multiplier;
    }
    return FINAL_RULES.SLOWEST_MULTIPLIER;
}

function activeSeconds({ startedAt, finishedAt, pausedMs } = {}) {
    if (!startedAt || !finishedAt) return null;
    const start = new Date(startedAt).getTime();
    const end = new Date(finishedAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    const paused = Number.isFinite(pausedMs) && pausedMs > 0 ? pausedMs : 0;
    return Math.max(0, Math.round((end - start - paused) / 1000));
}
/**
 * Builds the full breakdown for a FINISHED save. Everything comes from server-written fields
 * (verified, wrongByLock, hintsByLock, playerScore, startedAt, finishedAt, pausedMs).
 * It never reads the client's `solved` list or the old `wrongGuesses` counter.
 * The caller must check "finished" and "has a v2 score" first (see helpers/finalize.js).
 * wrongPenalty is what is left after lock points and hints: lockPoints - hintPenalty - wrongPenalty = playerScore.
 * It is the points lost to repeated wrong guesses, already reduced if the floor lifted the score.
 */
function buildBreakdown(save) {
    const state = stateFromSave(save);
    const seconds = activeSeconds(save) ?? 0;
    const multiplier = timeMultiplier(seconds);

    const locksSolved = state.solved.length;
    const lockPoints = locksSolved * SCORE_RULES.SOLVE_POINTS;
    const hintsUsed = state.hintsByLock.length;
    const hintPenalty = hintsUsed * SCORE_RULES.HINT_COST;
    const penalizedWrongGuesses = Object.values(state.wrongByLock)
        .filter(Number.isFinite)
        .reduce((sum, n) => sum + Math.max(0, n - 1), 0);
    const wrongPenalty = Math.max(0, lockPoints - hintPenalty - state.playerScore);

    return {
        locksSolved, lockPoints, hintsUsed, hintPenalty,
        penalizedWrongGuesses, wrongPenalty,
        playerScore: state.playerScore,
        seconds, timeMultiplier: multiplier,
        timedScore: Math.round(state.playerScore * multiplier),
        goalBonus: FINAL_RULES.GOAL_BONUS, finalScore: FINAL_RULES.GOAL_BONUS + Math.round(state.playerScore * multiplier),
    };
}

module.exports = { FINAL_RULES, timeMultiplier, activeSeconds, buildBreakdown };
