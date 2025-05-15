const db = require("../config/db");

// Get all users (Admin only)
const getUsers = async (req, res) => {
  try {
    const { rows } = await db.query("SELECT id, name, role FROM users");
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching users:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get a specific user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      "SELECT id, name, role FROM users WHERE id = $1",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ data: rows[0] });
  } catch (error) {
    console.error("Error fetching user by ID:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get users by role (public route for login dropdown)
const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    console.log(`Fetching users for role: ${role}`);
    const { rows } = await db.query(
      "SELECT id, name, role FROM users WHERE role = $1",
      [role]
    );
    console.log(`Users found: ${JSON.stringify(rows)}`);
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching users by role:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get team members (for Team Lead dashboard dropdown)
const getTeamMembers = async (req, res) => {
  try {
    console.log("Fetching team members for user:", req.user);
    const { rows } = await db.query(
      "SELECT id, name FROM users WHERE role = $1",
      ["Team Member"]
    );
    console.log("Team members fetched:", rows);
    if (rows.length === 0) {
      console.log("No team members found in the database.");
    }
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching team members:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    if (error.code === "42P01") {
      return res
        .status(500)
        .json({
          message: "Users table not found. Please set up the database.",
        });
    }
    if (error.code === "28000" || error.code === "28P01") {
      return res
        .status(500)
        .json({ message: "Database authentication error." });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get user by name (for task assignment)
const getUserByName = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res
        .status(400)
        .json({ message: "Name query parameter is required" });
    }
    const { rows } = await db.query(
      "SELECT id, name FROM users WHERE name = $1",
      [name]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching user by name:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  getUsers,
  getUserById,
  getUsersByRole,
  getTeamMembers,
  getUserByName,
};
