const express = require("express");
const crypto = require("crypto");
const File = require("../models/file");
const Save = require("../models/save");
const { requireLogin } = require("../helpers/auth");
const { isLocked, openView } = require("../helpers/openview");

const router = express.Router();

const hash = (s) =>
    crypto.createHash("sha256").update(String(s).trim().toLowerCase()).digest("hex");

router.get("/:slug", async (req, res) => {
    try {
        const f = await File.findOne({ slug: req.params.slug });
        if (!f) return res.status(404).json({ error: "not found" });

        if (isLocked(f)) {
            return res.json({
                slug: f.slug, name: f.name, type: f.type, locked: true,
                lock: { prompt: f.lock.prompt, hint: f.lock.hint }
            });
        }
        res.json(await openView(f));
    } catch (e) {
        res.status(500).json({ error: "server error" });
    }
});

router.post("/:slug/solve", requireLogin, async (req, res) => {
    try {
        const { answer } = req.body || {};
        if (answer === undefined) return res.status(400).json({ error: "need an answer" });

        const f = await File.findOne({ slug: req.params.slug });
        if (!f) return res.status(404).json({ error: "not found" });
        if (!isLocked(f)) return res.status(400).json({ error: "not locked" });

        if (hash(answer) !== f.lock.answerHash) {
            await Save.updateOne(
                { user: req.user.id },
                {
                    $inc: { wrongGuesses: 1 },
                    $setOnInsert: { startedAt: new Date() }
                },
                { upsert: true }
            );
            return res.json({ correct: false });
        }

        await Save.updateOne(
            { user: req.user.id },
            { $addToSet: { verified: f.slug }, $setOnInsert: { startedAt: new Date() }},
            { upsert: true }
        );
        res.json({ correct: true, item: await openView(f) });
    } catch (e) {
        res.status(500).json({ error: "server error" });
    }
});

module.exports = router;