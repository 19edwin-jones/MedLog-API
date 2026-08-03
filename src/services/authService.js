const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

// Cost factor for bcrypt hashing; higher is slower to brute-force but slower to log in.
const SALT_ROUNDS = 10;

// Issue a signed JWT whose subject (`sub`) is the user id. The middleware later
// reads this back as req.userId. Token stops being accepted after JWT_EXPIRES_IN.
function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function validatePassword(password) {
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return {
    isValid: hasUppercase && hasNumber && hasSpecial,
    missingUppercase: !hasUppercase,
    missingNumber: !hasNumber,
    missingSpecial: !hasSpecial
  };
}

async function register(data) {
  const { email, password } = data;

  if (!email || !password) {
    const error = new Error("VALIDATION_ERROR");
    error.details = "email and password are required";
    throw error;
  }
  if (password.length < 8) {
    const error = new Error("VALIDATION_ERROR");
    error.details = "password must be at least 8 characters";
    throw error;
  }
  // Validate password complexity
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    const error = new Error("VALIDATION_ERROR");
    error.details = "password must contain at least one uppercase letter, one number, and one special character";
    throw error;
  }

  // Enforce one account per email.
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new Error("EMAIL_TAKEN");
  }

  // Never store the raw password — only its bcrypt hash.
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ email, passwordHash });

  return { user: { id: user._id, email: user.email }, token: signToken(user) };
}

async function login(data) {
  const { email, password } = data;

  if (!email || !password) {
    const error = new Error("VALIDATION_ERROR");
    error.details = "email and password are required";
    throw error;
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    // Same error whether the email is unknown or the password is wrong, so
    // attackers can't probe which emails are registered.
    throw new Error("INVALID_CREDENTIALS");
  }

  // Compare the submitted password against the stored hash.
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new Error("INVALID_CREDENTIALS");
  }

  return { user: { id: user._id, email: user.email }, token: signToken(user) };
}

module.exports = {
  register,
  login,
};
