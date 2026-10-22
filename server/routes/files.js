const express = require("express");
const crypto = require("crypto");
const File = require("../models/file");
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

router.post("/:slug/solve", async (req, res) => {
    try {
        const { answer } = req.body || {};
        if (answer === undefined) return res.status(400).json({ error: "need an answer" });

        const f = await File.findOne({ slug: req.params.slug });
        if (!f) return res.status(404).json({ error: "not found" });
        if (!isLocked(f)) return res.status(400).json({ error: "not locked" });

        if (hash(answer) !== f.lock.answerHash) return res.json({ correct: false });
        res.json({ correct: true, item: await openView(f) });
    } catch (e) {
        res.status(500).json({ error: "server error" });
    }
});

module.exports = router;