const express = require("express");
const mongoose = require("mongoose");
const Save = require("../models/save");
const File = require("../models/file");
const User = require("../models/user");
const { requireLogin } = require("../helpers/auth");
const { openView } = require("../helpers/openview");
const { readSaveBody, buildSaveChange } = require("../helpers/saveBody");
const { pauseRun, resumeRun } = require("../helpers/pause");

const router = express.Router();

router.use(requireLogin);


function targetId(req, res) {
    const { userId } = req.params;
    if (userId === "me" || userId === req.user.id) return req.user.id;
    if (req.user.role !== "admin") {
        res.status(403).json({ error: "not your save" });
        return null;
    }
    if (!mongoose.isValidObjectId(userId)) {
        res.status(400).json({ error: "bad user id" });
        return null;
    }
    return userId;
}

//load
router.get("/:userId", async (req, res) => {
    const id = targetId(req, res);
    if (!id) return;
    try {
        const save = await Save.findOne({ user: id });
        if (!save) return res.status(404).json({ error: "no save found" });

        const files = await File.find({ slug: { $in: [...save.solved, ...save.hintsSeen] } });
        const bySlug = new Map(files.map((f) => [f.slug, f]));

        const readDocuments = save.hintsSeen
            .filter((s) => bySlug.has(s))
            .map((s) => ({ slug: s, name: bySlug.get(s).name }));
        const items = await Promise.all(
            save.solved.filter((s) => bySlug.has(s)).map((s) => openView(bySlug.get(s)))
        );

        res.json({ ...save.toObject(), readDocuments, items });
    } catch (e) {
        res.status(500).json({ error: "server error" });
    }
});

//save
router.put("/:userId", async (req, res) => {
    const id = targetId(req, res);
    if (!id) return;

    /**
     * Only solved, readDocuments and location are read from the body (see helpers/saveBody.js). 
     * Score fields, wrongGuesses and verified are never read. Only /solve and /hint change them.
     */
    const body = readSaveBody(req.body);
    if (body.error) return res.status(400).json({ error: body.error });
    const { solved, readDocuments, location } = body.value;

    try {
        const list = [...new Set(solved)];
        const known = await File.countDocuments({ slug: { $in: list } });
        if (known !== list.length) return res.status(400).json({ error: "unknown slug in solved" });

        const before = await Save.findOne({ user: id });
        const verified = new Set(before?.verified ?? []);
        if (!list.every((s) => verified.has(s))) {
            return res.status(400).json({ error: "solved has a lock that was never solved" });
        }

        let docs;
        if (readDocuments !== undefined) {
            docs = [...new Set(readDocuments)];
            const real = await File.countDocuments({ slug: { $in: docs }, type: "file" });
            if (real !== docs.length) return res.status(400).json({ error: "unknown file in readDocuments" });
        }

        const folder = await File.exists({ slug: location, type: "folder" });
        if (!folder) return res.status(400).json({ error: "location is not a folder" });

        if (!(await User.exists({ _id: id }))) return res.status(404).json({ error: "user not found" });

        // finishedAt is not set here. The server stamps it when the last lock is solved (helpers/scoreStore.js).
        const change = buildSaveChange({ list, location, docs });
        const save = await Save.findOneAndUpdate({ user: id }, change, {
            upsert: true,
            returnDocument: "after"
        });
        res.json(save);
    } catch (e) {
        res.status(500).json({ error: "server error" });
    }
});

function clockRoute(run) {
    return async (req, res) => {
        try {
            const { status, body } = await run(req.user.id);
            res.status(status).json(body);
        } catch (e) {
            if (e.code === "SCORE_CONFLICT") return res.status(409).json({ error: "too many requests at once, try again" });
            res.status(500).json({ error: "server error" });
        }
    };
}
router.post("/me/pause", clockRoute(pauseRun));
router.post("/me/resume", clockRoute(resumeRun));

router.delete("/:userId", async (req, res) => {
    const id = targetId(req, res);
    if (!id) return;
    try {
        const gone = await Save.findOneAndDelete({ user: id });
        if (!gone) return res.status(404).json({ error: "no save found" });
        res.json({ message: "save deleted" });
    } catch (e) {
        res.status(500).json({ error: "server error" });
    }
});

module.exports = router;