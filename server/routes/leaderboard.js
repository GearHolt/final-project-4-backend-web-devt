const express = require("express");
const mongoose = require("mongoose");
const Score = require("../models/score");
const Save = require("../models/save");
const { requireLogin, requireAdmin } = require("../helpers/auth");

const router = express.Router();

const HALF_MARKS = 300; // seconds to get half the speed points
const PUBLIC_FIELDS = "user username score seconds wrongGuesses createdAt";

// Only checks the token when ?all=true is asked for, so the normal top 10 stays public.
function adminIfAll(req, res, next) {
    if (req.query.all !== "true") return next();
    requireLogin(req, res, (err) => {
        if (err) return next(err);
        requireAdmin(req, res, next);
    });
}

// top 10 for anyone, every entry for admins (?all=true)
router.get("/", adminIfAll, async (req, res) => {
    try {
        let query = Score.find().sort({ score: -1, createdAt: 1 }).select(PUBLIC_FIELDS);
        if (req.query.all !== "true") query = query.limit(10);
        res.json(await query);
    } catch (e) {
        res.status(500).json({ error: "server error" });
    }
});

// submit, the score comes from the player's save
router.post("/", requireLogin, async (req, res) => {
    try {
        const WRONG_PENALTY = 50;
        const save = await Save.findOne({ user: req.user.id });
        if (!save) return res.status(400).json({ error: "no save found, finish the game first" });
        if (!save.finishedAt) return res.status(400).json({ error: "game not finished yet" });
        if (!save.startedAt) return res.status(400).json({ error: "save has no start time, start a new game" });

        const seconds = Math.max(0, Math.round((save.finishedAt - save.startedAt) / 1000));
        const speedPoints = Math.round((1000 * HALF_MARKS) / (HALF_MARKS + seconds));
        const wrong = save.wrongGuesses ?? 0;
        const score = Math.max(0, speedPoints - wrong * WRONG_PENALTY);

        const old = await Score.findOne({ user: req.user.id });
        if (old && old.score >= score) return res.json({ ...old.toObject(), improved: false });

        const entry = await Score.findOneAndUpdate(
            { user: req.user.id },
            { username: req.user.username, score, seconds, wrongGuesses: wrong, createdAt: new Date() },
            { upsert: true, returnDocument: "after" }
        );
        res.status(201).json({ ...entry.toObject(), improved: true });
    } catch (e) {
        if (e.code === 11000) return res.status(409).json({ error: "score already submitted, try again" });
        res.status(500).json({ error: "server error" });
    }
});

// admins only: change the score of one entry
router.patch("/:id", requireLogin, requireAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: "bad id" });
    }
    const { score } = req.body || {};
    if (!Number.isInteger(score) || score < 0) {
        return res.status(400).json({ error: "score must be a whole number, 0 or more" });
    }
    try {
        const entry = await Score.findByIdAndUpdate(
            req.params.id,
            { score },
            { returnDocument: "after" }
        ).select(PUBLIC_FIELDS);
        if (!entry) return res.status(404).json({ error: "entry not found" });
        res.json(entry);
    } catch (e) {
        res.status(500).json({ error: "server error" });
    }
});

// admins only: delete the score of one entry
router.delete("/:id", requireLogin, requireAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: "bad id" });
    }
    try {
        const gone = await Score.findByIdAndDelete(req.params.id);
        if (!gone) return res.status(404).json({ error: "entry not found" });
        res.json({ message: "entry deleted" });
    } catch (e) {
        res.status(500).json({ error: "server error" });
    }
});

module.exports = router;