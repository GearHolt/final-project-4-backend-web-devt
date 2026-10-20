const express = require("express");
const mongoose = require("mongoose");
const Score = require("../models/score");
const Save = require("../models/save");
const { requireLogin, requireAdmin } = require("../helpers/auth");

const router = express.Router();

const HALF_MARKS = 300; // seconds to get half the speed points

// top 10, anyone can look
router.get("/", async (req, res) => {
    try {
        const top = await Score.find()
            .sort({ score: -1, createdAt: 1 })
            .limit(10)
            .select("username score seconds wrongGuesses createdAt");
        res.json(top);
    } catch (e) {
        res.status(500).json({ error: "server error" });
    }
});

// submit, the score comes from the player's save
router.post("/", requireLogin, async (req, res) => {
    try {
        const save = await Save.findOne({ user: req.user.id });
        if (!save) return res.status(400).json({ error: "no save found, finish the game first" });
        if (!save.finishedAt) return res.status(400).json({ error: "game not finished yet" });
        if (!save.startedAt) return res.status(400).json({ error: "save has no start time, start a new game" });

        const seconds = Math.max(0, Math.round((save.finishedAt - save.startedAt) / 1000));
        const speedPoints = Math.round((1000 * HALF_MARKS) / (HALF_MARKS + seconds));
        const score = Math.max(0, speedPoints - save.wrongGuesses * 50);

        const old = await Score.findOne({ user: req.user.id });
        if (old && old.score >= score) return res.json(old); // keep the best one

        const entry = await Score.findOneAndUpdate(
            { user: req.user.id },
            { username: req.user.username, score, seconds, wrongGuesses: save.wrongGuesses, createdAt: new Date() },
            { upsert: true, returnDocument: "after" }
        );
        res.status(201).json(entry);
    } catch (e) {
        res.status(500).json({ error: "server error" });
    }
});

// admins only
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