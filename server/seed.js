require("dotenv").config();
const crypto = require("crypto");
const mongoose = require("mongoose");
const File = require("./models/file");
const maze = require("./seed/maze.json");

const hash = (s) =>
    crypto.createHash("sha256").update(String(s).trim().toLowerCase()).digest("hex");

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        await File.deleteMany({});
        const docs = maze.map(({ lock, ...rest }) => ({
            ...rest,
            lock: lock
                ? { prompt: lock.prompt, hint: lock.hint, answerHash: hash(lock.answer) }
                : undefined
        }));
        await File.insertMany(docs);
        console.log(`Seeded ${docs.length} items`);
    } catch (err) {
        console.error("Seed failed:", err);
    } finally {
        await mongoose.disconnect();
    }
})();