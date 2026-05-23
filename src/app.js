require("dotenv").config();

const express = require("express");
const medLogRoutes = require("./routes/medLogRoutes");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

app.use("/api/medlogs", medLogRoutes);

module.exports = app;
