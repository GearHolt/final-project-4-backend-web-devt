const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, trim: true },
    usernameLower: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["player", "admin"], default: "player" },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", UserSchema);