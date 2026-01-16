const db = require("../config/db");

// Log that the controller is being loaded
console.log("users.controller.js loaded successfully");

/**
 * Get all users (Admin only)
 */
const getUsers = async (req, res) => {
  try {
    const { rows } = await db.query("SELECT id, name, role FROM users");
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching users:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Get a specific user by ID
 */
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

/**
 * Get users by role (public route for login dropdown)
 * Handles URL-encoded role names like "Team%20Member"
 */
const getUsersByRole = async (req, res) => {
  console.log("===========================================");
  console.log("getUsersByRole CALLED");
  console.log("Timestamp:", new Date().toISOString());

  try {
    // Get the role parameter - Express should auto-decode it, but let's be explicit
    let { role } = req.params;

    // Decode the role in case it wasn't automatically decoded
    // This handles cases like "Team%20Member" -> "Team Member"
    role = decodeURIComponent(role);

    console.log(`Original role param: ${req.params.role}`);
    console.log(`Decoded role: "${role}"`);
    console.log(`Role length: ${role.length}`);

    // Validate role exists
    if (!role || role.trim() === '') {
      console.error("ERROR: No role parameter provided or empty after decode");
      return res.status(400).json({
        message: "Role parameter is required",
        received: role
      });
    }

    // Trim any whitespace
    role = role.trim();

    // Validate against allowed roles
    const allowedRoles = [
      "Data Entry",
      "Team Member",
      "Team Lead",
      "Project Manager",
      "Admin"
    ];

    if (!allowedRoles.includes(role)) {
      console.error(`Invalid role: "${role}"`);
      console.error("Allowed roles:", allowedRoles);
      return res.status(400).json({
        message: "Invalid role. Allowed roles: " + allowedRoles.join(", "),
        received: role,
        allowedRoles: allowedRoles
      });
    }

    // Query database
    const queryText = "SELECT id, name, role FROM users WHERE role = $1 ORDER BY name ASC";
    console.log("Executing query:", queryText);
    console.log("Query parameter:", [role]);

    const { rows } = await db.query(queryText, [role]);

    console.log(`Query successful! Found ${rows.length} users with role "${role}"`);
    console.log("Users found:", JSON.stringify(rows, null, 2));

    // Return response
    const response = {
      data: rows,
      count: rows.length,
      requestedRole: role
    };

    console.log("Sending response with", rows.length, "users");
    console.log("===========================================");

    return res.status(200).json(response);

  } catch (error) {
    console.error("===========================================");
    console.error("ERROR IN getUsersByRole");
    console.error("Error type:", error.constructor.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    console.error("Error stack:", error.stack);
    console.error("===========================================");

    return res.status(500).json({
      message: "Server error while fetching users by role",
      error: error.message,
      errorCode: error.code
    });
  }
};

/**
 * Get team members (for Team Lead dashboard dropdown)
 */
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
      return res.status(500).json({
        message: "Users table not found. Please set up the database.",
      });
    }
    if (error.code === "28000" || error.code === "28P01") {
      return res.status(500).json({
        message: "Database authentication error."
      });
    }
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

/**
 * Get user by name (for task assignment)
 */
const getUserByName = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({
        message: "Name query parameter is required"
      });
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
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  getUsersByRole,
  getTeamMembers,
  getUserByName,
};