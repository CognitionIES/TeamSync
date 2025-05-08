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
      console.log("Token received:", token); // Log the token

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Decoded token:", decoded); // Log the decoded payload

      // Validate decoded.id
      if (!decoded.id) {
        console.error("Decoded token does not contain an 'id' field");
        res.status(401);
        throw new Error("Not authorized, invalid token payload");
      }

      // Get user from token
      const { rows } = await db.query(
        "SELECT id, name, role FROM users WHERE id = $1",
        [decoded.id]
      );
      console.log("Database query result:", rows); // Log the query result

      if (rows.length === 0) {
        res.status(401);
        throw new Error("Not authorized, user not found");
      }

      // Add user to request
      req.user = {
        id: rows[0].id,
        name: rows[0].name,
        role: rows[0].role,
      };

      // Validate req.user.id
      if (!req.user.id) {
        console.error("req.user.id is undefined after setting req.user");
        res.status(401);
        throw new Error("Not authorized, user ID missing");
      }

      console.log("User set in req.user:", req.user); // Log before proceeding
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
    if (!req.user) {
      res.status(401);
      return res.json({ message: "Not authorized, user not set" });
    }
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
