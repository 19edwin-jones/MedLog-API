const mongoose = require("mongoose");

const medLogSchema = new mongoose.Schema(
  {
    // Owner of this log. Every query filters on it so users only see their own
    // data; indexed because it's part of nearly every lookup.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    medication: {
      type: String,
      required: true,
      trim: true,
    },
    doseMg: {
      type: Number,
      required: true,
      min: 0,
    },
    takenAt: {
      type: Date,
      required: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("MedLog", medLogSchema);
