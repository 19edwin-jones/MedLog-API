const MedLog = require("../models/MedLog");

function getDoseWindow(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { startOfDay: start, endOfDay: end };
}

async function createMedLog(data) {
  const { medication, doseMg, takenAt, notes } = data;

  if (!medication || doseMg == null || !takenAt) {
    const error = new Error("VALIDATION_ERROR");
    error.details = "medication, doseMg, and takenAt are required";
    throw error;
  }
  if (doseMg <= 0) {
    const error = new Error("VALIDATION_ERROR");
    error.details = "doseMg must be greater than 0";
    throw error;
  }

  const takenDate = new Date(takenAt);

  if (Number.isNaN(takenDate.getTime())) {
    const error = new Error("VALIDATION_ERROR");
    error.details = "takenAt must be a valid date";
    throw error;
  }

  const { startOfDay, endOfDay } = getDoseWindow(takenDate);

  const count = await MedLog.countDocuments({
    takenAt: { $gte: startOfDay, $lte: endOfDay },
  });

  if (count >= 2) {
    throw new Error("MAX_DAILY_DOSES_EXCEEDED");
  }

  return MedLog.create({
    medication,
    doseMg,
    takenAt: takenDate,
    notes,
  });
}

async function getMedLogs() {
  return MedLog.find().sort({ takenAt: -1 });
}

async function getMedLogById(id) {
  const medLog = await MedLog.findById(id);

  if (!medLog) {
    throw new Error("NOT_FOUND");
  }

  return medLog;
}

async function updateMedLog(id, data) {
  const medLog = await MedLog.findById(id);
  if (!medLog) {
    throw new Error("NOT_FOUND");
  }

  const { medication, doseMg, takenAt, notes } = data;

  if (doseMg !== undefined && doseMg <= 0) {
    const error = new Error("VALIDATION_ERROR");
    error.details = "doseMg must be greater than 0";
    throw error;
  }
  if (medication !== undefined) medLog.medication = medication;
  if (doseMg !== undefined) medLog.doseMg = doseMg;
  if (takenAt !== undefined) {
    const takenDate = new Date(takenAt);
    if (Number.isNaN(takenDate.getTime())) {
      const error = new Error("VALIDATION_ERROR");
      error.details = "takenAt must be a valid date";
      throw error;
    }

    const { startOfDay, endOfDay } = getDoseWindow(takenDate);

    const count = await MedLog.countDocuments({
      _id: { $ne: id }, // exclude current record
      takenAt: { $gte: startOfDay, $lte: endOfDay },
    });

    if (count >= 2) {
      throw new Error("MAX_DAILY_DOSES_EXCEEDED");
    }

    medLog.takenAt = takenDate;
  }
  if (notes !== undefined) medLog.notes = notes;

  return medLog.save();
}

async function deleteMedLog(id) {
  const medLog = await MedLog.findById(id);
  if (!medLog) {
    throw new Error("NOT_FOUND");
  }
  await MedLog.deleteOne();
}

module.exports = {
  createMedLog,
  getMedLogs,
  getMedLogById,
  updateMedLog,
  deleteMedLog,
};
