// HTTP layer for auth: delegates to the service and maps its thrown error codes
// (VALIDATION_ERROR, EMAIL_TAKEN, INVALID_CREDENTIALS) onto HTTP status codes.
const {
  register: registerService,
  login: loginService,
} = require("../services/authService");

async function register(req, res) {
  try {
    const result = await registerService(req.body);
    res.status(201).json(result);
  } catch (error) {
    if (error.message === "VALIDATION_ERROR") {
      return res.status(400).json({ error: error.details });
    }

    if (error.message === "EMAIL_TAKEN") {
      return res.status(409).json({ error: "Email is already registered" });
    }

    console.error("register error:", error.message);
    res.status(500).json({ error: "Failed to register" });
  }
}

async function login(req, res) {
  try {
    const result = await loginService(req.body);
    res.json(result);
  } catch (error) {
    if (error.message === "VALIDATION_ERROR") {
      return res.status(400).json({ error: error.details });
    }

    if (error.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    console.error("login error:", error.message);
    res.status(500).json({ error: "Failed to log in" });
  }
}

module.exports = {
  register,
  login,
};
