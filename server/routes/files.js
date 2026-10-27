const express = require("express");
const crypto = require("crypto");
const File = require("../models/file");
const { recordScoreEvent } = require("../helpers/scoreStore");
const { requireLogin } = require("../helpers/auth");
const { isLocked, openView, lockedView } = require("../helpers/openview");
const { revealHint } = require("../helpers/hint");
const { lockSlugs } = require("../helpers/locks");
const { solveLimiter, hintLimiter } = require("../helpers/rateLimit");

const router = express.Router();

const hash = (s) =>
    crypto.createHash("sha256").update(String(s).trim().toLowerCase()).digest("hex");

router.get("/:slug", async (req, res) => {
    try {
        const f = await File.findOne({ slug: req.params.slug });
        if (!f) return res.status(404).json({ error: "not found" });

        if (isLocked(f)) {
            return res.json(lockedView(f));
        }
        res.json(await openView(f));
    } catch (e) {
        res.status(500).json({ error: "server error" });
    }
});

// Limiters run after requireLogin (they key on req.user.id) and before any scoring, so a blocked request is never a wrong guess.
router.post("/:slug/solve", requireLogin, solveLimiter, async (req, res) => {
    try {
        const { answer } = req.body || {};
        if (answer === undefined) return res.status(400).json({ error: "need an answer" });

        const f = await File.findOne({ slug: req.params.slug });
        if (!f) return res.status(404).json({ error: "not found" });
        if (!isLocked(f)) return res.status(400).json({ error: "not locked" });

        if (hash(answer) !== f.lock.answerHash) {
            const { state } = await recordScoreEvent(req.user.id, { type: "wrong", slug: f.slug });
            return res.json({ correct: false, score: state.playerScore });
        }

        // lockSlugs lets the solve that verifies the last lock finish the run (stamp finishedAt).
        const { state } = await recordScoreEvent(req.user.id, { type: "solve", slug: f.slug }, undefined, { lockSlugs: () => lockSlugs(File) });
        res.json({ correct: true, item: await openView(f), score: state.playerScore });
    } catch (e) {
        if (e.code === "SCORE_CONFLICT") return res.status(409).json({ error: "too many requests at once, try again" });
        res.status(500).json({ error: "server error" });
    }
});

// Reveals a lock's hint. The first reveal per lock costs points; repeats are free.
router.post("/:slug/hint", requireLogin, hintLimiter, async (req, res) => {
    try {
        const { status, body } = await revealHint(req.user.id, req.params.slug);
        res.status(status).json(body);
    } catch (e) {
        if (e.code === "SCORE_CONFLICT") return res.status(409).json({ error: "too many requests at once, try again" });
        res.status(500).json({ error: "server error" });
    }
});

module.exports = router;
