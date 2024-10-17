const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");

// Middleware to authenticate JWT token
exports.authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized access" });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      logger.error(`JWT verification error: ${err.message}`);
      return res.status(403).json({ error: "Token is invalid or expired" });
    }
    req.user = user;
    next();
  });
};
