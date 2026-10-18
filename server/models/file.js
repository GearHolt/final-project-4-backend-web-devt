const mongoose = require("mongoose");

const FileSchema = new mongoose.Schema({
    slug: { type: String, unique: true, required: true },
    name: String,
    type: { type: String, enum: ["folder", "file"], required: true },
    parent: { type: String, default: null },
    document: mongoose.Schema.Types.Mixed,
    lock: { prompt: String, hint: String, answerHash: String },
    isFinal: { type: Boolean, default: false }
});

module.exports = mongoose.model("File", FileSchema);