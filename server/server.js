require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));

app.get("/health", (req, res) => res.send("ok"));

app.use("/api/files", require("./routes/files"));

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => console.log(`Running on ${PORT}`));
    })
    .catch(err => console.error("DB connection failed:", err));