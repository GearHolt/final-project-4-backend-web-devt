const mongoose = require("mongoose");

const ScoreSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    username: String,
    score: { type: Number, required: true },
    seconds: Number,
    wrongGuesses: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Score", ScoreSchema);