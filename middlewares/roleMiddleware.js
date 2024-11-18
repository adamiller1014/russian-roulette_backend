exports.checkRole = (requiredRole) => (req, res, next) => {
  if (!req.user || req.user.role !== requiredRole) {
    return res.status(403).json({ error: "Forbidden: Insufficient role" });
  }
  next();
};
