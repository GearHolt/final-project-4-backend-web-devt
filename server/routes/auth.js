const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const validateUsername = require("../utils/validateUsername");
const signToken = require("../utils/token");
const { requireLogin } = require("../helpers/auth");

const router = express.Router();

router.post("/register", async (req, res) => {
    const { username, password } = req.body || {};

    const problem = validateUsername(username);
    if (problem) return res.status(400).json({ error: problem });
    if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ error: "password too short (min 6)" });
    }

    const name = username.trim();
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({
            username: name,
            usernameLower: name.toLowerCase(),
            passwordHash
        });
        res.status(201).json({
            token: signToken(user._id.toString()),
            user: { id: user._id, username: user.username, role: user.role }
        });
    } catch (e) {
        if (e.code === 11000) return res.status(409).json({ error: "Username is already taken" });
        res.status(500).json({ error: "server error" });
    }
});

router.post("/login", async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || typeof password !== "string") {
        return res.status(400).json({ error: "need username and password" });
    }
    try {
        const user = await User.findOne({ usernameLower: username.trim().toLowerCase() });
        const ok = user && (await bcrypt.compare(password, user.passwordHash));
        if (!ok) return res.status(401).json({ error: "wrong username or password" });
        res.json({
            token: signToken(user._id.toString()),
            user: { id: user._id, username: user.username, role: user.role }
        });
    } catch (e) {
        res.status(500).json({ error: "server error" });
    }
});

router.get("/me", requireLogin, (req, res) => res.json(req.user));

module.exports = router;