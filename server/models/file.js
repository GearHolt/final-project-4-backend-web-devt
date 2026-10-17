const mongoose = require("mongoose");

const FileSchema = new mongoose.Schema({
    slug: { type: String, unique: true, required: true },
    room: String,
    title: String,
    document: mongoose.Schema.Types.Mixed,
    puzzle: {
        prompt: String,
        hint: String,
        answerHash: String
    },
    exits: [{ label: String, to: String }],
    isStart: { type: Boolean, default: false },
    isFinal: { type: Boolean, default: false }
});

module.exports = mongoose.model("File", FileSchema);