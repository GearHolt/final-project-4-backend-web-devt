const FileModel = require("../models/file");
const SaveModel = require("../models/save");
const { isLocked } = require("./openview");
const { stateFromSave } = require("../utils/score");
const { recordScoreEvent } = require("./scoreStore");

async function revealHint(userId, slug, { File = FileModel, Save = SaveModel } = {}) {
    const f = await File.findOne({ slug });
    if (!f) return { status: 404, body: { error: "not found" } };
    if (!isLocked(f)) return { status: 400, body: { error: "not locked" } };
    if (!f.lock.hint) return { status: 400, body: { error: "no hint for this lock" } };

    const state = stateFromSave(await Save.findOne({ user: userId }));
    if (state.solved.includes(slug) || state.hintsByLock.includes(slug)) {
        return { status: 200, body: { hint: f.lock.hint, score: state.playerScore } };
    }

    const { state: next } = await recordScoreEvent(userId, { type: "hint", slug }, Save);
    return { status: 200, body: { hint: f.lock.hint, score: next.playerScore } };
}

module.exports = { revealHint };
