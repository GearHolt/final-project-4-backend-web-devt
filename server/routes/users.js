const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/user");
const Save = require("../models/save");
const Score = require("../models/score");
const { requireLogin, requireAdmin } = require("../helpers/auth");

const router = express.Router();

router.use(requireLogin, requireAdmin);

//delete a player, their saves, and their scores
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "bad user id" });
    if (id === req.user.id) return res.status(400).json({ error: "you can't delete your own account" });

    try {
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ error: "user not found" });
        if (user.role === "admin") return res.status(403).json({ error: "admin accounts can't be deleted here" });

        await Save.deleteMany({ user: id });
        await Score.deleteMany({ user: id });
        await user.deleteOne();

        res.json({ message: "user deleted" });
    } catch (e) {
        res.status(500).json({ error: "server error" });
    }
});

//for admins to get userIDs
router.get("/", async (req, res) => {
    try {
        const users = await User.find().select("username role createdAt").sort("username");
        res.json(users);
    } catch (e) {
        res.status(500).json({ error: "server error" });
    }
});

module.exports = router;