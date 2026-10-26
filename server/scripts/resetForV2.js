require("dotenv").config();
const mongoose = require("mongoose");
const Save = require("../models/save");
const Score = require("../models/score");

(async () => {
    if (process.env.CONFIRM_WIPE !== "yes") {
        console.log("Refusing to run. Set CONFIRM_WIPE=yes to wipe saves and scores.");
        process.exit(1);
    }
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(`Connected to database: ${mongoose.connection.name}`);
        const saves = await Save.deleteMany({});
        const scores = await Score.deleteMany({});
        console.log(`Deleted ${saves.deletedCount} saves, ${scores.deletedCount} scores`);
    } catch (err) {
        console.error("Reset failed:", err);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
})();