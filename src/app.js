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

// Catch errors raised outside the controllers (e.g. malformed JSON from
// express.json()) so clients get JSON instead of Express's HTML page, which
// includes a stack trace when NODE_ENV isn't "production".
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error("unhandled error:", err.message);
  }
  res.status(status).json({
    error: status < 500 ? err.message : "Internal server error",
  });
});

module.exports = app;
