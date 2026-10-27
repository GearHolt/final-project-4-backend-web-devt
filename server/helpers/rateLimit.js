const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const LIMITS = {
    solve: { limit: 10, windowMs: 60_000 },
    hint: { limit: 10, windowMs: 60_000 },
};

const keyFor = (req) => (req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req.ip));

function tooMany(req, res) {
    const reset = req.rateLimit?.resetTime;
    const wait = reset ? Math.ceil((reset.getTime() - Date.now()) / 1000) : 60;
    const retryAfterSeconds = Math.max(1, wait);
    res.set("Retry-After", String(retryAfterSeconds));
    res.status(429).json({ error: "too many attempts, slow down", retryAfterSeconds });
}

function makeLimiter({ limit, windowMs }) {
    return rateLimit({
        windowMs, limit, keyGenerator: keyFor, handler: tooMany, 
        standardHeaders: false, legacyHeaders: false,
    });
}

module.exports = { LIMITS, makeLimiter, solveLimiter: makeLimiter(LIMITS.solve), hintLimiter: makeLimiter(LIMITS.hint) };