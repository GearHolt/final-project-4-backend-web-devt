const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");

function inject(rel, exports) {
    const file = require.resolve(path.join("..", rel));
    require.cache[file] = { id: file, filename: file, loaded: true, exports };
}
const { makeLimiter } = require("../helpers/rateLimit");
const hash = (s) => crypto.createHash("sha256").update(String(s).trim().toLowerCase()).digest("hex");
const LOCK = { slug: "vault", type: "folder", lock: { prompt: "p", hint: "h", answerHash: hash("door") } };
const calls = { score: 0, hint: 0, order: [] };

inject("helpers/auth", { requireLogin: (req, res, next) => { calls.order.push("login"); req.user = { id: req.headers["x-user"] || "u1" }; next(); } });
inject("helpers/rateLimit", { solveLimiter: makeLimiter({ limit: 2, windowMs: 60_000 }), hintLimiter: makeLimiter({ limit: 1, windowMs: 60_000 }) });
inject("helpers/hint", { revealHint: async () => { calls.hint++; return { status: 200, body: { hint: "h", score: 0 } }; } });
inject("models/file", { findOne: async ({ slug }) => (slug === "vault" ? LOCK : null), find: () => ({ select: async () => [{ slug: "vault" }], sort: async () => [] }) });
inject("helpers/scoreStore", { recordScoreEvent: async () => { calls.score++; return { state: { playerScore: 0 } }; } });
const router = require("../routes/files");

function start() {
    const app = express();
    app.use(express.json());
    app.use("/api/files", router);
    const server = app.listen(0);
    const post = (p, body, user) => fetch(`http://127.0.0.1:${server.address().port}/api/files${p}`, {
        method: "POST", headers: { "content-type": "application/json", ...(user ? { "x-user": user } : {}) }, body: JSON.stringify(body ?? {}),
    }).then(async (r) => ({ status: r.status, json: await r.json() }));
    return { post, close: () => server.close() };
}

test("solve: the 3rd wrong guess in a minute gets 429 and is NOT scored", async () => {
    calls.score = 0;
    const s = start();
    try {
        assert.equal((await s.post("/vault/solve", { answer: "a" }, "p1")).status, 200);
        assert.equal((await s.post("/vault/solve", { answer: "b" }, "p1")).status, 200);
        const blocked = await s.post("/vault/solve", { answer: "c" }, "p1");
        assert.equal(blocked.status, 429);
        assert.ok(blocked.json.retryAfterSeconds >= 1);
        assert.equal(calls.score, 2);
    } finally { s.close(); }
});

test("solve: even the correct answer is blocked once the limit is hit", async () => {
    const s = start();
    try {
        await s.post("/vault/solve", { answer: "a" }, "p2");
        await s.post("/vault/solve", { answer: "b" }, "p2");
        assert.equal((await s.post("/vault/solve", { answer: "door" }, "p2")).status, 429);
    } finally { s.close(); }
});

test("hint: the 2nd request in a minute gets 429 and does not reach revealHint", async () => {
    calls.hint = 0;
    const s = start();
    try {
        assert.equal((await s.post("/vault/hint", {}, "p3")).status, 200);
        assert.equal((await s.post("/vault/hint", {}, "p3")).status, 429);
        assert.equal(calls.hint, 1);
    } finally { s.close(); }
});

test("solve and hint counters are separate", async () => {
    const s = start();
    try {
        await s.post("/vault/solve", { answer: "a" }, "p4");
        await s.post("/vault/solve", { answer: "b" }, "p4");
        assert.equal((await s.post("/vault/solve", { answer: "c" }, "p4")).status, 429);
        assert.equal((await s.post("/vault/hint", {}, "p4")).status, 200);
    } finally { s.close(); }
});

test("the limiter runs after login, so a logged-out request is stopped by login, not counted", async () => {
    calls.order.length = 0;
    const s = start();
    try {
        await s.post("/vault/solve", { answer: "a" }, "p5");
        assert.deepEqual(calls.order, ["login"]);
    } finally { s.close(); }
});

test("a 404 on a bad slug still counts toward the limit (guessing slugs is also spam)", async () => {
    const s = start();
    try {
        await s.post("/nope/solve", { answer: "a" }, "p6");
        await s.post("/nope/solve", { answer: "a" }, "p6");
        assert.equal((await s.post("/nope/solve", { answer: "a" }, "p6")).status, 429);
    } finally { s.close(); }
});
