const express = require("express");
const router = express.Router();

const apiKeyAuth = require("../middleware/auth");
const {
  createMedLog,
  getMedLogs,
  getMedLogById,
  updateMedLog,
  deleteMedLog,
} = require("../controllers/medLogController");

router.use(apiKeyAuth);

router.get("/", getMedLogs);
router.post("/", createMedLog);
router.get("/:id", getMedLogById);
router.patch("/:id", updateMedLog);
router.delete("/:id", deleteMedLog);

module.exports = router;
