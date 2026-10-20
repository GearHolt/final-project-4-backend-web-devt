const mongoose = require("mongoose");

const SaveSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    hintsSeen: [String], //files containing hints that player has seen
    solved: [String], //solved ids
    location: { type: String, default: "root" },
    wrongGuesses: { type: Number, default: 0 },
    startedAt: Date,
    finishedAt: Date,
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Save", SaveSchema);