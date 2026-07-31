const MedLog = require("../models/MedLog");

// Returns the start/end timestamps of the calendar day containing `date`,
// used to count how many doses fall on that day. Uses the server's local time zone.
function getDoseWindow(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { startOfDay: start, endOfDay: end };
}

async function createMedLog(userId, data) {
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

  // Cap doses at 2 per calendar day, counting only this user's logs.
  const { startOfDay, endOfDay } = getDoseWindow(takenDate);

  const count = await MedLog.countDocuments({
    userId,
    takenAt: { $gte: startOfDay, $lte: endOfDay },
  });

  if (count >= 2) {
    throw new Error("MAX_DAILY_DOSES_EXCEEDED");
  }

  return MedLog.create({
    userId,
    medication,
    doseMg,
    takenAt: takenDate,
    notes,
  });
}

async function getMedLogs(userId) {
  return MedLog.find({ userId }).sort({ takenAt: -1 });
}

async function getMedLogById(userId, id) {
  // Matching on both _id and userId means one user can never read another's log —
  // a mismatched owner simply looks like "not found".
  const medLog = await MedLog.findOne({ _id: id, userId });

  if (!medLog) {
    throw new Error("NOT_FOUND");
  }

  return medLog;
}

async function updateMedLog(userId, id, data) {
  const medLog = await MedLog.findOne({ _id: id, userId });
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

    // Re-check the daily cap for the new date, ignoring this record itself.
    const { startOfDay, endOfDay } = getDoseWindow(takenDate);

    const count = await MedLog.countDocuments({
      userId,
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

async function deleteMedLog(userId, id) {
  // Scoped by userId so a user can only delete their own log; deletedCount of 0
  // means no such log existed for this user.
  const result = await MedLog.deleteOne({ _id: id, userId });
  if (result.deletedCount === 0) {
    throw new Error("NOT_FOUND");
  }
}

module.exports = {
  createMedLog,
  getMedLogs,
  getMedLogById,
  updateMedLog,
  deleteMedLog,
};
