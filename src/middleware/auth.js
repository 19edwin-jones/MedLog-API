const jwt = require("jsonwebtoken");

// Route guard: rejects any request without a valid JWT. Attach with
// router.use(jwtAuth) so every route below it requires authentication.
function jwtAuth(req, res, next) {
  // Expect an "Authorization: Bearer <token>" header.
  const header = req.header("authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
    // Throws if the token is tampered with, unsigned by us, or expired.
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Expose the user's id to downstream handlers so data can be scoped to them.
    req.userId = payload.sub;
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

module.exports = jwtAuth;
