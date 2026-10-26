const SaveModel = require("../models/save");
const { stateFromSave } = require("../utils/score");
const { clockFromSave, creditLeftMs, pauseClock, settlePause } = require("../utils/clock");
const { updateRun } = require("./scoreStore");

function view(clock, save) {
    return {
        paused: clock.pausedAt !== null,
        pausedMs: clock.pausedMs,
        creditLeftMs: creditLeftMs(clock),
        score: stateFromSave(save).playerScore,
    };
}

async function change(userId, step, { Save = SaveModel, now = () => new Date() } = {}) {
    const { result } = await updateRun(userId, (current) => {
        const t = now().getTime();
        const { clock, changed } = step(clockFromSave(current), t);
        const body = view(clock, current);
        if (!changed) return { update: null, result: body };
        return {
            update: { $set: { pausedAt: clock.pausedAt === null ? null : new Date(clock.pausedAt), pausedMs: clock.pausedMs } },
            result: body,
            upsert: false,
        };
    }, Save);
    return { status: 200, body: result };
}

const pauseRun = (userId, opts) => change(userId, pauseClock, opts);
const resumeRun = (userId, opts) => change(userId, settlePause, opts);

module.exports = { pauseRun, resumeRun };