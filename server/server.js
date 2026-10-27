require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const allowed = (process.env.CLIENT_URL || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
const app = express();

app.set("trust proxy", 1);

app.use(express.json());

app.use(cors({ origin: allowed.length ? allowed : "*" }));

app.get("/health", (req, res) => res.send("ok"));

app.use("/api/files", require("./routes/files"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/saves", require("./routes/saves"));
app.use("/api/leaderboard", require("./routes/leaderboard"));
app.use("/api/users", require("./routes/users"));
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ error: "Request body is not valid JSON" });
    }
    console.error(err);
    res.status(500).json({ error: "server error" });
});
app.get("/", (req, res) => res.send("minosdb api"));

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => console.log(`Running on ${PORT}`));
    })
    .catch(err => console.error("DB connection failed:", err));