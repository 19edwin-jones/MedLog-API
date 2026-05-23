function apiKeyAuth(req, res, next) {
  const providedKey = req.header("x-api-key");
  const expectedKey = process.env.API_KEY;

  if (!providedKey) {
    return res.status(401).json({
      error: "Authentication required"
    });
  }

  if (providedKey !== expectedKey) {
    return res.status(403).json({
      error: "Invalid API key"
    });
  }

  next();
}

module.exports = apiKeyAuth;
