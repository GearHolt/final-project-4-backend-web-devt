const mongoose = require("mongoose");

const SaveSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    hintsSeen: [String],
    solved: [String],
    verified: [String], //slugs the SERVER saw solved correctly. Only /solve writes this.
    location: { type: String, default: "root" },
    wrongGuesses: { type: Number, default: 0 },
    // Scoring v2. All of these are written only by the server (never from a request body).
    playerScore: { type: Number, default: 0 },
    wrongByLock: { type: mongoose.Schema.Types.Mixed, default: {} }, // { lockSlug: wrongGuessCount }
    hintsByLock: [String], // locks whose hint was already charged
    pausedAt: Date, // set while the run is paused; null/missing otherwise. Only /pause, /resume and score events change it
    pausedMs: { type: Number, default: 0 }, // pause time credited so far (capped, see utils/clock.js)
    scoreRev: { type: Number, default: 0 }, // bumped on every score write; guards against lost updates
    startedAt: Date,
    finishedAt: Date,
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Save", SaveSchema);
