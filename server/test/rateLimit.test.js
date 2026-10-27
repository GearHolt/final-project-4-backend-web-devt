const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { makeLimiter, LIMITS } = require("../helpers/rateLimit");

// A tiny app: a fake login sets req.user from the x-user header, then the limiter, then a handler that counts calls.
async function setup(options) {
    const limiter = makeLimiter(options);
    const hits = { n: 0 };
    const app = express();
    app.use((req, res, next) => { req.user = { id: req.headers["x-user"] || "u1" }; next(); });
    app.post("/x", limiter, (req, res) => { hits.n++; res.json({ ok: true }); });
    const server = app.listen(0);
    const call = (user = "u1") =>
        fetch(`http://127.0.0.1:${server.address().port}/x`, { method: "POST", headers: { "x-user": user } })
            .then(async (r) => ({ status: r.status, retryAfter: r.headers.get("retry-after"), json: await r.json() }));
    return { call, hits, close: () => server.close() };
}

test("the defaults are 10 requests per minute for solve and for hint", () => {
    assert.equal(LIMITS.solve.limit, 10);
    assert.equal(LIMITS.solve.windowMs, 60_000);
    assert.equal(LIMITS.hint.limit, 10);
    assert.equal(LIMITS.hint.windowMs, 60_000);
});

test("requests under the limit pass through", async () => {
    const t = await setup({ limit: 2, windowMs: 60_000 });
    try {
        assert.equal((await t.call()).status, 200);
        assert.equal((await t.call()).status, 200);
        assert.equal(t.hits.n, 2);
    } finally { t.close(); }
});

test("the request over the limit gets 429 and never reaches the handler", async () => {
    const t = await setup({ limit: 2, windowMs: 60_000 });
    try {
        await t.call(); await t.call();
        const r = await t.call();
        assert.equal(r.status, 429);
        assert.equal(t.hits.n, 2);
    } finally { t.close(); }
});

test("a 429 has a Retry-After header and a body with error and retryAfterSeconds", async () => {
    const t = await setup({ limit: 1, windowMs: 60_000 });
    try {
        await t.call();
        const r = await t.call();
        assert.equal(typeof r.json.error, "string");
        assert.ok(Number.isInteger(r.json.retryAfterSeconds));
        assert.ok(r.json.retryAfterSeconds >= 1 && r.json.retryAfterSeconds <= 60);
        assert.equal(Number(r.retryAfter), r.json.retryAfterSeconds);
    } finally { t.close(); }
});

test("the limit is per user id, so one player cannot block another", async () => {
    const t = await setup({ limit: 1, windowMs: 60_000 });
    try {
        await t.call("alice");
        assert.equal((await t.call("alice")).status, 429);
        assert.equal((await t.call("bob")).status, 200);
    } finally { t.close(); }
});

test("the window resets: after it passes the user can call again", async () => {
    const t = await setup({ limit: 1, windowMs: 150 });
    try {
        await t.call();
        assert.equal((await t.call()).status, 429);
        await new Promise((r) => setTimeout(r, 250));
        assert.equal((await t.call()).status, 200);
    } finally { t.close(); }
});

test("two limiters keep separate counters", async () => {
    const a = makeLimiter({ limit: 1, windowMs: 60_000 });
    const b = makeLimiter({ limit: 1, windowMs: 60_000 });
    const app = express();
    app.use((req, res, next) => { req.user = { id: "u1" }; next(); });
    app.post("/a", a, (q, s) => s.json({}));
    app.post("/b", b, (q, s) => s.json({}));
    const server = app.listen(0);
    const post = (p) => fetch(`http://127.0.0.1:${server.address().port}${p}`, { method: "POST" }).then((r) => r.status);
    try {
        assert.equal(await post("/a"), 200);
        assert.equal(await post("/a"), 429);
        assert.equal(await post("/b"), 200);
    } finally { server.close(); }
});
