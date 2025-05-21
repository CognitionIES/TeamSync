const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const { protect } = require("../middleware/auth");
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { role, name, password } = req.body;
    if (!role || !name || !password) {
      return res
        .status(400)
        .json({ message: "Please provide role, name and password" });
    }
    // Query placeholder - replace with actual query to your users table
    const { rows } = await db.query(
      "SELECT * FROM users WHERE name = $1 AND role = $2",
      [name, role]
    );

    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    res.status(200).json({
      id: user.id,
      name: user.name,
      role: user.role,
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Validate token
// @route   GET /api/auth/validate
// @access  Private
const validateToken = async (req, res) => {
  res.status(200).json({ user: req.user });
};

// Generate JWT
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

module.exports = {
  login,
  validateToken,
};
