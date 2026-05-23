const express = require("express");
const router = express.Router();
const apiKeyAuth = require("../middleware/auth");

router.use(apiKeyAuth);

router.get("/", (req, res) => {
  res.json({ message: "Here are your logs" });
});

router.post("/", (req, res) => {
  res.json({ message: "Log created" });
});

module.exports = router;
