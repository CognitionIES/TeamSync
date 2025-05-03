const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const db = require("../config/db");

// Protect routes - verify token
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check if token is in headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const { rows } = await db.query(
        "SELECT id, name, role FROM users WHERE id = $1",
        [decoded.id]
      );

      if (rows.length === 0) {
        res.status(401);
        throw new Error("Not authorized, user not found");
      }

      // Add user to request
      req.user = {
        userId: rows[0].id,
        name: rows[0].name,
        role: rows[0].role,
      };

      next();
    } catch (error) {
      console.error("Token verification failed:", error.message);
      res.status(401);
      throw new Error("Not authorized, token failed");
    }
  } else {
    res.status(401);
    throw new Error("Not authorized, no token");
  }
});

// Check roles - restrict access based on role
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      res.status(403);
      return res.json({
        message: `User role ${req.user.role} is not authorized to perform this action`,
      });
    }
    next();
  };
};

module.exports = {
  protect,
  authorize,
};
