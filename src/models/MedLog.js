const mongoose = require("mongoose");

const medLogSchema = new mongoose.Schema(
  {
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
