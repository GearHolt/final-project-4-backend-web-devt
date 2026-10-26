const FileModel = require("../models/file");
const SaveModel = require("../models/save");
const ScoreModel = require("../models/score");
const { SCORE_RULES, stateFromSave } = require("../utils/score");
const { buildBreakdown } = require("../utils/finalScore");

const bad = (error) => ({ status: 400, body: { error } });

async function checkFinished(save, File) {
    if (!save) return bad("no save found, finish the game first");

    const locks = await File.find({ "lock.answerHash": { $exists: true } }).select("slug");
    const verified = new Set(stateFromSave(save).solved);
    const allVerified = locks.length > 0 && locks.every((l) => verified.has(l.slug));
    if (!allVerified || !save.finishedAt) return bad("game not finished yet");
    if (!save.startedAt) return bad("save has no start time, start a new game");

    if (!Number.isFinite(save.playerScore) || save.playerScore < SCORE_RULES.FLOOR) {
        return bad("save is from an older version, start a new game");
    }
    return null;
}

const plain = (doc) => (doc && typeof doc.toObject === "function" ? doc.toObject() : doc);
const summary = (score, seconds, breakdown) => ({ score, seconds, breakdown: breakdown ?? null });

async function submitFinalScore(userId, username, { Save = SaveModel, Score = ScoreModel, File = FileModel } = {}) {
    const save = await Save.findOne({ user: userId });
    const problem = await checkFinished(save, File);
    if (problem) return problem;

    const breakdown = buildBreakdown(save);
    const score = breakdown.finalScore;
    const run = summary(score, breakdown.seconds, breakdown);

    const old = plain(await Score.findOne({ user: userId }));
    if (old && old.score >= score) {
        return {
            status: 200,
            body: { ...old, improved: false, run, best: summary(old.score, old.seconds, old.breakdown) },
        };
    }

    const entry = plain(
        await Score.findOneAndUpdate(
            { user: userId },
            {
                username, score, seconds: breakdown.seconds,
                wrongGuesses: save.wrongGuesses ?? 0,
                breakdown, createdAt: new Date(),
            },
            { upsert: true, returnDocument: "after" }
        )
    );
    return { status: 201, body: { ...entry, improved: true, run, best: summary(score, breakdown.seconds, breakdown) } };
}

module.exports = { submitFinalScore };
