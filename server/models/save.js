const mongoose = require("mongoose");

const SaveSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    solved: [String], //solved ids
    location: { type: String, default: "root" }, //last known room
    wrongGuesses: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Save", SaveSchema);