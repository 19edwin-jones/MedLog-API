const mongoose = require("mongoose");
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

// A malformed id can't match any document, so treat it as "not found" instead of
// letting Mongoose throw a CastError (which would surface as a 500).
function assertValidId(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error("NOT_FOUND");
  }
}

function validationError(details) {
  const error = new Error("VALIDATION_ERROR");
  error.details = details;
  return error;
}

// Checks the types of any fields present; missing fields are allowed so this
// works for both create and partial updates.
function validateFieldTypes({ medication, doseMg, notes }) {
  if (medication !== undefined && (typeof medication !== "string" || !medication.trim())) {
    throw validationError("medication must be a non-empty string");
  }
  // Numeric strings like "10" are accepted (Apple Shortcuts sends numbers as
  // strings); callers store Number(doseMg).
  if (
    doseMg !== undefined &&
    ((typeof doseMg !== "number" && typeof doseMg !== "string") ||
      !Number.isFinite(Number(doseMg)) ||
      !(Number(doseMg) > 0))
  ) {
    throw validationError("doseMg must be a number greater than 0");
  }
  if (notes !== undefined && typeof notes !== "string") {
    throw validationError("notes must be a string");
  }
}

// Express 5 leaves req.body undefined when no JSON body is sent, hence the default.
async function createMedLog(userId, data = {}) {
  const { medication, doseMg, takenAt, notes } = data;

  if (!medication || doseMg == null || !takenAt) {
    throw validationError("medication, doseMg, and takenAt are required");
  }
  validateFieldTypes({ medication, doseMg, notes });

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
    doseMg: Number(doseMg),
    takenAt: takenDate,
    notes,
  });
}

async function getMedLogs(userId) {
  return MedLog.find({ userId }).sort({ takenAt: -1 });
}

async function getMedLogById(userId, id) {
  assertValidId(id);
  // Matching on both _id and userId means one user can never read another's log —
  // a mismatched owner simply looks like "not found".
  const medLog = await MedLog.findOne({ _id: id, userId });

  if (!medLog) {
    throw new Error("NOT_FOUND");
  }

  return medLog;
}

async function updateMedLog(userId, id, data = {}) {
  assertValidId(id);
  const medLog = await MedLog.findOne({ _id: id, userId });
  if (!medLog) {
    throw new Error("NOT_FOUND");
  }

  const { medication, doseMg, takenAt, notes } = data;
  validateFieldTypes({ medication, doseMg, notes });
  if (medication !== undefined) medLog.medication = medication;
  if (doseMg !== undefined) medLog.doseMg = Number(doseMg);
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
  assertValidId(id);
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
