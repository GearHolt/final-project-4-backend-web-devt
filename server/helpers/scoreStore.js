const Save = require("../models/save");
const { applyEvent, stateFromSave } = require("../utils/score");
const { clockFromSave, settlePause } = require("../utils/clock");

const MAX_TRIES = 4;

async function updateRun(userId, compute, Model = Save) {
    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
        const current = await Model.findOne({ user: userId });
        const plan = await compute(current);
        if (!plan.update) return { save: current, result: plan.result };

        const rev = Number.isFinite(current?.scoreRev) ? current.scoreRev : 0;
        const update = { ...plan.update, $inc: { ...(plan.update.$inc ?? {}), scoreRev: 1 } };
        const upsert = plan.upsert !== false;

        try {
            const save = await Model.findOneAndUpdate(
                { user: userId, scoreRev: rev === 0 ? { $in: [0, null] } : rev },
                update,
                { upsert, returnDocument: "after" }
            );
            // Without upsert, a lost race (or a deleted Save) matches nothing and gives null: read again.
            if (save) return { save, result: plan.result };
        } catch (e) {
            // Someone else wrote first: the upsert collides with the unique index on user.
            if (e.code !== 11000) throw e;
        }
    }
    const err = new Error("score update kept conflicting");
    err.code = "SCORE_CONFLICT";
    throw err;
}

async function recordScoreEvent(userId, event, Model = Save, options = {}) {
    const now = options.now ?? (() => new Date());
    const { save, result } = await updateRun(userId, async (current) => {
        const t = now();
        const next = applyEvent(stateFromSave(current), event);
        const update = {
            $set: {
                playerScore: next.playerScore,
                wrongByLock: next.wrongByLock,
                hintsByLock: next.hintsByLock,
            },
            $inc: {},
        };
        let clock = clockFromSave(current);

        if (event.type !== "hint" && !current?.startedAt) {
            update.$set.startedAt = t;
            clock = { ...clock, startedAt: t.getTime() };
        }

        const settled = settlePause(clock, t.getTime());
        if (settled.changed) {
            update.$set.pausedMs = settled.clock.pausedMs;
            update.$set.pausedAt = null;
            clock = settled.clock;
        }

        if (event.type === "solve") update.$addToSet = { verified: event.slug };
        if (event.type === "wrong") update.$inc.wrongGuesses = 1;

        if (event.type === "solve" && options.lockSlugs && clock.finishedAt === null) {
            const locks = await options.lockSlugs();
            if (locks.length > 0 && locks.every((s) => next.solved.includes(s))) update.$set.finishedAt = t;
        }
        return { update, result: next };
    }, Model);
    return { save, state: result };
}

module.exports = { recordScoreEvent, updateRun };