const express = require("express");
const mongoose = require("mongoose");
const Score = require("../models/score");
const { requireLogin, requireAdmin } = require("../helpers/auth");
const { submitFinalScore } = require("../helpers/finalize");

const router = express.Router();

const PUBLIC_FIELDS = "user username score seconds wrongGuesses breakdown createdAt";

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

router.post("/", requireLogin, async (req, res) => {
    try {
        const { status, body } = await submitFinalScore(req.user.id, req.user.username);
        res.status(status).json(body);
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