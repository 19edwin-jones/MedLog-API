// Placeholder router with stubbed responses. Not currently mounted in app.js
// (medLogRoutes handles the real endpoints); kept as a scaffold.
const express = require("express");
const router = express.Router();
const jwtAuth = require("../middleware/auth"); // JWT guard despite the legacy name

router.use(jwtAuth);

router.get("/", (req, res) => {
  res.json({ message: "Here are your logs" });
});

router.post("/", (req, res) => {
  res.json({ message: "Log created" });
});

module.exports = router;
