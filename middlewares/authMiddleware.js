const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const User = require("../models/User");

exports.authenticateJWT = async (req, res, next) => {
  try {
    // Log the start of the authentication process
    logger.info("Starting JWT authentication process");

    // Check for Authorization header
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      logger.warn("Authorization header missing");
      return res.status(401).json({ 
        success: false,
        error: 'Authorization header required' 
      });
    }

    // Extract and validate token format
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;
    if (!token) {
      logger.warn("Token missing from Authorization header");
      return res.status(401).json({ 
        success: false,
        error: 'Valid token required' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    logger.info(`Token verified for user ID: ${decoded.id}`);

    // Fetch current user data
    const user = await User.findById(decoded.id).select('-password').lean();
    if (!user) {
      logger.warn(`User not found for ID: ${decoded.id}`);
      return res.status(401).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      logger.warn(`User account is not active for ID: ${decoded.id}`);
      return res.status(401).json({ 
        success: false,
        error: 'User account is not active' 
      });
    }

    // Attach user to request object
    req.user = {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
      user_level: user.user_level
    };

    logger.info(`User authenticated successfully: ${user.email}`);
    next();
  } catch (error) {
    logger.error(`Authentication middleware error: ${error.message}`);
    return res.status(500).json({ 
      success: false,
      error: 'Authentication failed' 
    });
  }
};
