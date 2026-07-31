require("dotenv").config();

const express = require("express");
const authRoutes = require("./routes/authRoutes");
const medLogRoutes = require("./routes/medLogRoutes");

const app = express();

// Parse JSON request bodies into req.body.
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

// Public auth endpoints (register/login) — no token required.
app.use("/api/auth", authRoutes);
// Med-log endpoints — protected by JWT inside the router.
app.use("/api/medlogs", medLogRoutes);

module.exports = app;
