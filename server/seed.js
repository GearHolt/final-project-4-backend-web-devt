require("dotenv").config();
const crypto = require("crypto");
const mongoose = require("mongoose");
const File = require("./models/File");
const maze = require("./seed/maze.json");

const hash = (s) =>
    crypto.createHash("sha256").update(String(s).trim().toLowerCase()).digest("hex");

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        await File.deleteMany({});
        const docs = maze.map(({ puzzle, ...rest }) => ({
            ...rest,
            puzzle: puzzle
                ? { prompt: puzzle.prompt, hint: puzzle.hint, answerHash: hash(puzzle.answer) }
                : undefined
        }));
        await File.insertMany(docs);
        console.log(`Seeded ${docs.length} files`);
    } catch (err) {
        console.error("Seed failed:", err);
    } finally {
        await mongoose.disconnect();
    }
})();