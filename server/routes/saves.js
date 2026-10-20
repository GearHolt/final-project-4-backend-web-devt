const express = require("express");
const mongoose = require("mongoose");
const Save = require("../models/save");
const File = require("../models/file");
const User = require("../models/user");
const { requireLogin } = require("../helpers/auth");

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
        res.json(save);
    } catch (e) {
        res.status(500).json({ error: "server error" });
    }
});

//save
router.put("/:userId", async (req, res) => {
    const id = targetId(req, res);
    if (!id) return;

    const { solved, location = "root", wrongGuesses = 0 } = req.body || {};
    if (!Array.isArray(solved) || !solved.every((s) => typeof s === "string")) {
        return res.status(400).json({ error: "solved must be a list of slugs" });
    }
    if (!Number.isInteger(wrongGuesses) || wrongGuesses < 0) {
        return res.status(400).json({ error: "wrongGuesses must be 0 or more" });
    }

    try {
        const list = [...new Set(solved)];
        const known = await File.countDocuments({ slug: { $in: list } });
        if (known !== list.length) return res.status(400).json({ error: "unknown slug in solved" });

        const folder = await File.exists({ slug: location, type: "folder" });
        if (!folder) return res.status(400).json({ error: "location is not a folder" });

        if (!(await User.exists({ _id: id }))) return res.status(404).json({ error: "user not found" });

        // finished once every lock is in the list, the server stamps the time itself
        const locks = await File.find({ "lock.answerHash": { $exists: true } }).select("slug");
        const finished = locks.every((l) => list.includes(l.slug));
        const before = await Save.findOne({ user: id });

        const change = {
            $set: { solved: list, location, wrongGuesses, updatedAt: new Date() },
            $setOnInsert: { startedAt: new Date() }
        };
        if (!finished) change.$unset = { finishedAt: "" };
        else if (!before || !before.finishedAt) change.$set.finishedAt = new Date();

        const save = await Save.findOneAndUpdate({ user: id }, change, {
            upsert: true,
            returnDocument: "after"
        });
        res.json(save);
    } catch (e) {
        res.status(500).json({ error: "server error" });
    }
});

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