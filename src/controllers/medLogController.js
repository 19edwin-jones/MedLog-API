// HTTP layer for med logs: reads req.userId (set by the JWT middleware) and
// req.body, delegates to the service, and maps the service's thrown error codes
// (VALIDATION_ERROR, NOT_FOUND, ...) onto HTTP status codes.
const {
  createMedLog: createMedLogService,
  getMedLogs: getMedLogsService,
  updateMedLog: updateMedLogService,
  deleteMedLog: deleteMedLogService,
  getMedLogById: getMedLogByIdService,
} = require("../services/medLogService");

async function createMedLog(req, res) {
  try {
    const medLog = await createMedLogService(req.userId, req.body);
    res.status(201).json(medLog);
  } catch (error) {
    if (error.message === "VALIDATION_ERROR") {
      return res.status(400).json({ error: error.details });
    }

    if (error.message === "MAX_DAILY_DOSES_EXCEEDED") {
      return res.status(400).json({
        error: "Maximum of 2 doses per day exceeded",
      });
    }

    console.error("createMedLog error:", error.message);
    res.status(500).json({ error: "Failed to create medication log" });
  }
}

async function getMedLogs(req, res) {
  try {
    const medLogs = await getMedLogsService(req.userId);
    res.json(medLogs);
  } catch (error) {
    console.error("getMedLogs error:", error.message);
    res.status(500).json({
      error: "Failed to fetch medication logs",
    });
  }
}

async function getMedLogById(req, res) {
  try {
    const { id } = req.params;
    const medLog = await getMedLogByIdService(req.userId, id);
    res.json(medLog);
  } catch (error) {
    if (error.message === "NOT_FOUND") {
      return res.status(404).json({ error: "Medication log not found" });
    }

    console.error("getMedLogById error:", error.message);
    res.status(500).json({
      error: "Failed to fetch medication log",
    });
  }
}

async function updateMedLog(req, res) {
  try {
    const { id } = req.params;
    const updatedLog = await updateMedLogService(req.userId, id, req.body);
    res.json(updatedLog);
  } catch (error) {
    if (error.message === "VALIDATION_ERROR") {
      return res.status(400).json({ error: error.details });
    }

    if (error.message === "NOT_FOUND") {
      return res.status(404).json({ error: "Medication log not found" });
    }

    console.error("updateMedLog error:", error.message);
    res.status(500).json({
      error: "Failed to update medication log",
    });
  }
}

async function deleteMedLog(req, res) {
  try {
    const { id } = req.params;
    await deleteMedLogService(req.userId, id);
    res.json({ message: "Medication log deleted" });
  } catch (error) {
    if (error.message === "NOT_FOUND") {
      return res.status(404).json({ error: "Medication log not found" });
    }

    console.error("deleteMedLog error:", error.message);
    res.status(500).json({
      error: "Failed to delete medication log",
    });
  }
}

module.exports = {
  createMedLog,
  getMedLogs,
  getMedLogById,
  updateMedLog,
  deleteMedLog,
};
