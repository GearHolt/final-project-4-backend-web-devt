const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const File = require("../models/file");
const Save = require("../models/save");

const router = express.Router();

const hash = (s) =>
    crypto.createHash("sha256").update(String(s).trim().toLowerCase()).digest("hex");

const isLocked = (f) => !!(f.lock && f.lock.answerHash);


function userIdFrom(req) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return null;
    try {
        return jwt.verify(token, process.env.JWT_SECRET).id;
    } catch (e) {
        return null;
    }
}

async function noteRead(req, f) {
    if (f.type !== "file") return;
    const id = userIdFrom(req);
    if (!id) return;
    await Save.updateOne({ user: id }, { $addToSet: { hintsSeen: f.slug } });
}

async function openView(f) {
    const out = { slug: f.slug, name: f.name, type: f.type, isFinal: f.isFinal, locked: false };
    if (f.type === "file") {
        out.document = f.document;
    } else {
        const kids = await File.find({ parent: f.slug }).sort("name");
        out.children = kids.map((k) => ({
            slug: k.slug, name: k.name, type: k.type, locked: isLocked(k)
        }));
    }
    return out;
}

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
        await noteRead(req, f);
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
        await noteRead(req, f);
        res.json({ correct: true, item: await openView(f) });
    } catch (e) {
        res.status(500).json({ error: "server error" });
    }
});

module.exports = router;