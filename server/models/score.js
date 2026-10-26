const mongoose = require("mongoose");

/* How the score was made (scoring v2). Old entries from before v2 have none. 
If buildBreakdown() in utils/finalScore.js gets a new field, add it here too
(test/scoreModel.test.js fails if one is missing, because mongoose drops unknown fields).
 */

const BreakdownSchema = new mongoose.Schema({
    locksSolved: Number, lockPoints: Number,
    hintsUsed: Number, hintPenalty: Number,
    penalizedWrongGuesses: Number, wrongPenalty: Number,
    playerScore: Number, seconds: Number,
    timeMultiplier: Number, timedScore: Number,
    goalBonus: Number, finalScore: Number
}, { _id: false });

const ScoreSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    username: String,
    score: { type: Number, required: true },
    seconds: Number,
    wrongGuesses: { type: Number, default: 0 },
    breakdown: { type: BreakdownSchema, default: undefined },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Score", ScoreSchema);
