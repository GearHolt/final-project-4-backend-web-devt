// Scoring v2 engine: pure functions, no database, no clock.
// All tunable numbers live in SCORE_RULES so they can be changed in one place.

const SCORE_RULES = {
    SOLVE_POINTS: 200,
    REPEAT_WRONG_MULTIPLIER: 0.9,
    HINT_COST: 20,
    FLOOR: 100,
};

const list = (v) => (Array.isArray(v) ? [...v] : []);
const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function stateFromSave(save) {
    return {
        playerScore: Number.isFinite(save?.playerScore) ? save.playerScore : 0,
        solved: list(save?.verified),
        wrongByLock: isPlainObject(save?.wrongByLock) ? { ...save.wrongByLock } : {},
        hintsByLock: list(save?.hintsByLock),
    };
}

function withFloor(state) {
    if (state.solved.length >= 1 && state.playerScore < SCORE_RULES.FLOOR) {
        state.playerScore = SCORE_RULES.FLOOR;
    }
    return state;
}

function applyEvent(state, event) {
    const next = {
        playerScore: state.playerScore,
        solved: [...state.solved],
        wrongByLock: { ...state.wrongByLock },
        hintsByLock: [...state.hintsByLock],
    };
    const alreadySolved = next.solved.includes(event.slug);

    if (event.type === "solve") {
        if (alreadySolved) return next;
        next.solved.push(event.slug);
        next.playerScore += SCORE_RULES.SOLVE_POINTS;
    } else if (event.type === "wrong") {
        if (alreadySolved) return next; // no penalty on a lock that is already beaten
        const before = next.wrongByLock[event.slug] ?? 0;
        next.wrongByLock[event.slug] = before + 1;
        if (before >= 1 && next.playerScore > 0) {
            next.playerScore = Math.round(next.playerScore * SCORE_RULES.REPEAT_WRONG_MULTIPLIER);
        }
    } else if (event.type === "hint") {
        if (alreadySolved || next.hintsByLock.includes(event.slug)) return next;
        next.hintsByLock.push(event.slug);
        next.playerScore -= SCORE_RULES.HINT_COST;
    }
    return withFloor(next);
}

module.exports = { SCORE_RULES, stateFromSave, applyEvent };
