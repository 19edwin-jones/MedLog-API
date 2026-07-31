const express = require("express");
const router = express.Router();

const jwtAuth = require("../middleware/auth");
const {
  createMedLog,
  getMedLogs,
  getMedLogById,
  updateMedLog,
  deleteMedLog,
} = require("../controllers/medLogController");

// Every route below requires a valid JWT; req.userId is set for the handlers.
router.use(jwtAuth);

router.get("/", getMedLogs);
router.post("/", createMedLog);
router.get("/:id", getMedLogById);
router.patch("/:id", updateMedLog);
router.delete("/:id", deleteMedLog);

module.exports = router;
