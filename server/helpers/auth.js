const jwt = require("jsonwebtoken");
const User = require("../models/user");

async function requireLogin(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "not logged in" });

    try {
        const { id } = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(id);
        if (!user) return res.status(401).json({ error: "account no longer exists" });
        req.user = { id: user._id.toString(), username: user.username, role: user.role };
        next();
    } catch (e) {
        res.status(401).json({ error: "bad or expired token" });
    }
}

function requireAdmin(req, res, next) {
    if (req.user.role !== "admin") return res.status(403).json({ error: "admins only" });
    next();
}

module.exports = { requireLogin, requireAdmin };