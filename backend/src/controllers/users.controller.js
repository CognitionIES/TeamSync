const db = require("../config/db");
const bcrypt = require("bcryptjs");

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

/**
 * Create user (Admin only)
 * Accepts: name, password, role, is_active (optional, defaults to true)
 */
const createUser = async (req, res) => {
  try {
    const { name, password, role, is_active = true } = req.body;

    // Validation
    if (!name || !password || !role) {
      return res.status(400).json({
        message: "name, password, and role are required"
      });
    }

    // Validate role
    const validRoles = ["Data Entry", "Team Member", "Team Lead", "Project Manager", "Admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid role",
        allowed: validRoles
      });
    }

    // Hash the password
    const hashed = await bcrypt.hash(password, 10);

    // Insert user
    const { rows } = await db.query(
      `INSERT INTO users (name, password, role, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, role, is_active`,
      [name, hashed, role, is_active]
    );

    console.log("User created successfully:", rows[0]);
    res.status(201).json({
      message: "User created successfully",
      data: rows[0]
    });
  } catch (err) {
    console.error("Error creating user:", err);

    // Handle duplicate username
    if (err.code === '23505') {
      return res.status(409).json({
        message: "User name already exists"
      });
    }

    res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Update user team membership (Admin only)
 * Replaces current team with a new one
 */
const updateUserTeam = async (req, res) => {
  const { id } = req.params;        // user id
  const { lead_id } = req.body;     // new team lead id OR null to remove

  try {
    // Start transaction
    await db.query('BEGIN');

    // Remove from all current teams
    await db.query(
      'DELETE FROM team_members WHERE member_id = $1',
      [id]
    );

    // Add to new team if provided
    if (lead_id && lead_id !== 'none') {
      // Get team lead name for team_name
      const { rows: leadRows } = await db.query(
        'SELECT name FROM users WHERE id = $1',
        [lead_id]
      );

      const teamName = leadRows.length > 0 ? `Team ${leadRows[0].name}` : 'Team';

      await db.query(
        'INSERT INTO team_members (lead_id, member_id, team_name) VALUES ($1, $2, $3)',
        [lead_id, id, teamName]
      );
    }

    await db.query('COMMIT');

    console.log(`User ${id} team updated. New lead: ${lead_id || 'none'}`);
    res.status(200).json({
      message: 'Team updated successfully',
      userId: id,
      newLeadId: lead_id || null
    });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error("Error updating user team:", err);
    res.status(500).json({
      message: "Failed to update team",
      error: err.message
    });
  }
};

/**
 * Get all users with their current team information (Admin only)
 * Returns users with their team lead details
 */
const getUsersWithTeam = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        u.id, 
        u.name, 
        u.role, 
        u.is_active,
        tm.lead_id AS team_lead_id,
        lead.name AS team_lead_name
      FROM users u
      LEFT JOIN team_members tm ON tm.member_id = u.id
      LEFT JOIN users lead ON tm.lead_id = lead.id
      ORDER BY u.name
    `);

    console.log(`Fetched ${rows.length} users with team info`);
    res.json({ data: rows });
  } catch (err) {
    console.error("Error fetching users with team:", err);
    res.status(500).json({
      message: "Failed to fetch users with team information",
      error: err.message
    });
  }
};

/**
 * Update user role (Admin only)
 */
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Validate role
    const validRoles = ["Data Entry", "Team Member", "Team Lead", "Project Manager", "Admin"];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid role",
        allowed: validRoles
      });
    }

    const { rows } = await db.query(
      `UPDATE users 
       SET role = $1 
       WHERE id = $2 
       RETURNING id, name, role, is_active`,
      [role, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log(`User ${id} role updated to ${role}`);
    res.status(200).json({
      message: "User role updated successfully",
      data: rows[0]
    });
  } catch (err) {
    console.error("Error updating user role:", err);
    res.status(500).json({
      message: "Failed to update user role",
      error: err.message
    });
  }
};

/**
 * Delete user (Admin only)
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Start transaction
    await db.query('BEGIN');

    // Remove from teams first (foreign key constraint)
    await db.query('DELETE FROM team_members WHERE member_id = $1', [id]);

    // Delete the user
    const { rows } = await db.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, name',
      [id]
    );

    if (rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ message: "User not found" });
    }

    await db.query('COMMIT');

    console.log(`User ${id} (${rows[0].name}) deleted successfully`);
    res.status(200).json({
      message: "User deleted successfully",
      deletedUser: rows[0]
    });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error("Error deleting user:", err);
    res.status(500).json({
      message: "Failed to delete user",
      error: err.message
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  getUsersByRole,
  getTeamMembers,
  getUserByName,
  createUser,
  updateUserTeam,
  getUsersWithTeam,
  updateUserRole,
  deleteUser,
};