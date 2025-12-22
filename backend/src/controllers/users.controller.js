const db = require("../config/db");

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
 * THIS IS THE KEY FUNCTION FOR YOUR LOGIN PAGE
 */
const getUsersByRole = async (req, res) => {
  // Add extensive logging
  console.log("===========================================");
  console.log("getUsersByRole CALLED");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Request params:", req.params);
  console.log("Request query:", req.query);
  console.log("Request headers:", req.headers);
  console.log("===========================================");

  try {
    const { role } = req.params;

    console.log(`Fetching users for role: "${role}"`);
    console.log("Role type:", typeof role);
    console.log("Role length:", role ? role.length : 0);

    // Check if role exists
    if (!role) {
      console.error("ERROR: No role parameter provided");
      return res.status(400).json({
        message: "Role parameter is required",
        received: { role: null }
      });
    }

    // Log the exact query being run
    const queryText = "SELECT id, name, role FROM users WHERE role = $1 ORDER BY name ASC";
    console.log("Executing query:", queryText);
    console.log("Query parameter:", [role]);

    // Execute query
    const result = await db.query(queryText, [role]);
    const { rows } = result;

    console.log(`Query successful! Found ${rows.length} users`);
    console.log("Users found:", JSON.stringify(rows, null, 2));

    // Return response
    const response = {
      data: rows,
      count: rows.length,
      requestedRole: role
    };

    console.log("Sending response:", JSON.stringify(response, null, 2));
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
      message: "Server error",
      error: error.message,
      errorCode: error.code,
      errorType: error.constructor.name
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