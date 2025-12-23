const express = require("express");
const {
  getUserById,
  getUsersByRole,
  getUserByName,
} = require("../controllers/users.controller");
const { protect, authorize } = require("../middleware/auth");
const db = require("../config/db");

const router = express.Router();
// Test 1: Ultra simple - no database, no nothing
router.get("/ping", (req, res) => {
  console.log("=== PING route hit ===");
  res.status(200).json({
    message: "pong",
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV
  });
});

// Test 2: Check if controller is loaded
router.get("/check-controller", (req, res) => {
  console.log("=== Checking controller ===");
  try {
    const controller = require("../controllers/users.controller");
    res.status(200).json({
      message: "Controller loaded successfully",
      functions: Object.keys(controller),
      getUsersByRoleExists: typeof controller.getUsersByRole === 'function'
    });
  } catch (error) {
    res.status(500).json({
      message: "Controller load failed",
      error: error.message,
      stack: error.stack
    });
  }
});

// Test 3: Check database connection
router.get("/check-db", async (req, res) => {
  console.log("=== Checking database ===");
  try {
    const { rows } = await db.query("SELECT NOW() as time, version() as version");
    res.status(200).json({
      message: "Database connected",
      serverTime: rows[0].time,
      postgresVersion: rows[0].version,
      hasDbUrl: !!process.env.DATABASE_URL
    });
  } catch (error) {
    res.status(500).json({
      message: "Database connection failed",
      error: error.message,
      errorCode: error.code,
      stack: error.stack
    });
  }
});

// Test 4: Simple role route without controller
router.get("/role-simple/:role", async (req, res) => {
  console.log("=== Simple role route ===");
  console.log("Role param:", req.params.role);

  try {
    const role = decodeURIComponent(req.params.role);
    console.log("Decoded role:", role);

    const { rows } = await db.query(
      "SELECT id, name, role FROM users WHERE role = $1 ORDER BY name ASC",
      [role]
    );

    console.log(`Found ${rows.length} users`);

    res.status(200).json({
      message: "Success",
      requestedRole: role,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Query failed",
      error: error.message,
      errorCode: error.code,
      stack: error.stack
    });
  }
});

// Test 5: Test the actual getUsersByRole controller
router.get("/role-controller/:role", async (req, res) => {
  console.log("=== Testing getUsersByRole controller ===");
  console.log("Role param:", req.params.role);

  try {
    const { getUsersByRole } = require("../controllers/users.controller");
    console.log("Controller function loaded:", typeof getUsersByRole);

    // Call the controller function
    await getUsersByRole(req, res);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({
      message: "Controller execution failed",
      error: error.message,
      stack: error.stack
    });
  }
});

// Test 6: Check all environment variables (without exposing sensitive data)
router.get("/check-env", (req, res) => {
  console.log("=== Checking environment ===");
  res.status(200).json({
    nodeEnv: process.env.NODE_ENV,
    hasDbUrl: !!process.env.DATABASE_URL,
    dbUrlLength: process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0,
    dbUrlStart: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 15) + "..." : "not set",
    allEnvKeys: Object.keys(process.env).filter(key => !key.includes('SECRET') && !key.includes('PASSWORD'))
  });
});
// Add this to users.routes.js temporarily
router.get("/debug-db-info", async (req, res) => {
  try {
    // Check current database
    const { rows: dbInfo } = await db.query("SELECT current_database(), current_schema()");

    // List all tables
    const { rows: tables } = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    res.status(200).json({
      currentDatabase: dbInfo[0],
      tablesFound: tables.map(t => t.table_name),
      tablesCount: tables.length
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: error.code
    });
  }
});

// PUBLIC ROUTES (NO AUTHENTICATION REQUIRED)
// Public test route to fetch all users
router.get("/test", async (req, res) => {
  console.log("=== /test route called ===");
  try {
    const { rows } = await db.query("SELECT * FROM users");
    console.log(`Test route: Found ${rows.length} users`);
    res.status(200).json({
      message: "Database query successful",
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error("Test route error:", error);
    res.status(500).json({
      message: "Database query failed",
      error: error.message
    });
  }
});

router.get("/role/:role", (req, res, next) => {
  console.log("=== /role/:role route matched ===");
  console.log("Role parameter:", req.params.role);
  next();
}, getUsersByRole);

// PROTECTED ROUTES (AUTHENTICATION REQUIRED)
// All routes below require authentication
router.use(protect);

// Fetch team members (for Team Lead dashboard dropdown)
router.get("/team-members", authorize(["Team Lead"]), async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("No user ID found in request. User:", req.user);
      return res.status(401).json({
        message: "User authentication failed. Please log in again."
      });
    }

    console.log("Fetching team members for Team Lead ID:", req.user.id);
    console.log("User role:", req.user.role);

    // Fetch team members
    const { rows: memberRows } = await db.query(
      `
      SELECT u.id, u.name, u.role
      FROM users u
      WHERE u.id IN (
        SELECT tm.member_id
        FROM team_members tm
        WHERE tm.lead_id = $1
      )
      `,
      [req.user.id]
    );

    // Fetch the team lead themselves
    const { rows: leadRows } = await db.query(
      `
      SELECT id, name, role
      FROM users
      WHERE id = $1
      `,
      [req.user.id]
    );

    // Combine team lead + team members
    const allMembers = [...leadRows, ...memberRows];

    console.log("Team members + lead fetched:", allMembers);

    if (allMembers.length === 1) {
      // Only the lead, no team members
      return res.status(200).json({
        data: allMembers,
        message: "No team members found. You can assign tasks to yourself.",
      });
    }

    res.status(200).json({ data: allMembers });
  } catch (error) {
    console.error("Error fetching team members:", error.message, error.stack);
    res.status(500).json({
      message: "Failed to fetch team members. Please try again later.",
      error: error.message,
    });
  }
});

// Fetch user by name (for task assignment)
router.get("/by-name", authorize(["Team Lead"]), getUserByName);

// Fetch all users (Admin and Project Manager can see all, others are scoped)
router.get("/", async (req, res) => {
  try {
    console.log("User role:", req.user.role);
    console.log("User ID:", req.user.id);

    if (["Admin", "Project Manager"].includes(req.user.role)) {
      console.log("Fetching all users for Admin/Project Manager...");
      const { rows } = await db.query(
        `SELECT id, name, role FROM users`
      );
      console.log("Users fetched for Admin/Project Manager:", rows);
      return res.status(200).json({ data: rows });
    } else if (req.user.role === "Team Lead") {
      console.log("Fetching team members for Team Lead ID:", req.user.id);
      const { rows } = await db.query(
        `
        SELECT u.id, u.name, u.role
        FROM users u
        WHERE u.id IN (
          SELECT tm.member_id
          FROM team_members tm
          WHERE tm.lead_id = $1
        )
        `,
        [req.user.id]
      );
      console.log("Users fetched for Team Lead:", rows);
      return res.status(200).json({ data: rows });
    } else if (req.user.role === "Team Member") {
      console.log("Fetching self for Team Member ID:", req.user.id);
      const { rows } = await db.query(
        `SELECT id, name, role FROM users WHERE id = $1`,
        [req.user.id]
      );
      console.log("Users fetched for Team Member:", rows);
      return res.status(200).json({ data: rows });
    } else {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to perform this action`,
      });
    }
  } catch (error) {
    console.error("Error fetching users:", error.message, error.stack);
    res.status(500).json({
      message: "Failed to fetch users",
      error: error.message
    });
  }
});

// Fetch assigned items for a specific user
router.get("/:userId/assigned-items/:taskId", protect, async (req, res) => {
  console.log(
    `Received request for /api/users/${req.params.userId}/assigned-items/${req.params.taskId}`
  );
  console.log(`Logged in user: ${req.user.id}, role: ${req.user.role}`);
  console.log(`Requested user: ${req.params.userId}`);

  try {
    // Allow Team Lead, Admin, Project Manager
    if (!["Team Lead", "Admin", "Project Manager"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Not authorized to view assigned items"
      });
    }

    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    // Team Lead access control
    if (req.user.role === "Team Lead") {
      console.log(
        `Checking access: userId=${userId}, req.user.id=${req.user.id}`
      );

      // Allow if viewing own tasks OR team member's tasks
      if (userId.toString() !== req.user.id.toString()) {
        console.log(`Not viewing own tasks, checking team membership`);
        const { rows: teamMemberCheck } = await db.query(
          "SELECT 1 FROM team_members WHERE member_id = $1 AND lead_id = $2",
          [userId, req.user.id]
        );

        console.log(`Team member check result:`, teamMemberCheck);

        if (teamMemberCheck.length === 0) {
          console.log(
            `Access denied: user ${userId} is not a team member of lead ${req.user.id}`
          );
          return res.status(403).json({
            message: "User is not a team member under this lead",
          });
        }
      } else {
        console.log(`Viewing own tasks - access granted`);
      }
    }

    // Fetch task
    const { rows: tasks } = await db.query(
      "SELECT id, type FROM tasks WHERE assignee_id = $1 AND id = $2",
      [userId, taskId]
    );

    if (tasks.length === 0) {
      return res.status(404).json({
        message: "Task not found for this user"
      });
    }

    const response = {
      data: {
        upvLines: { count: 0, items: [] },
        qcLines: { count: 0, items: [] },
        redlinePIDs: { count: 0, items: [] },
        upvEquipment: { count: 0, items: [] },
        qcEquipment: { count: 0, items: [] },
      },
    };

    const task = tasks[0];
    const taskIdFromTask = task.id;
    const taskType = task.type;

    console.log(
      `Fetching items for task ${taskIdFromTask} (type: ${taskType})`
    );

    if (taskType === "Redline") {
      const { rows: pidRows } = await db.query(
        `SELECT p.id, p.pid_number, p.project_id, pr.name AS project_name, a.name AS area_number
         FROM task_items ti
         JOIN pids p ON ti.item_id = p.id
         JOIN projects pr ON p.project_id = pr.id
         LEFT JOIN areas a ON p.area_id = a.id
         WHERE ti.task_id = $1 AND ti.item_type = 'PID'`,
        [taskIdFromTask]
      );
      response.data.redlinePIDs.items = pidRows.map((pid) => ({
        id: pid.id.toString(),
        pid_number: pid.pid_number,
        project_id: pid.project_id.toString(),
        project_name: pid.project_name,
        area_number: pid.area_number || "N/A",
      }));
      response.data.redlinePIDs.count = pidRows.length;
    } else if (taskType === "UPV") {
      const { rows: lineRows } = await db.query(
        `SELECT l.id, l.line_number, l.project_id, pr.name AS project_name, a.name AS area_number
         FROM task_items ti
         JOIN lines l ON ti.item_id = l.id
         JOIN projects pr ON l.project_id = pr.id
         LEFT JOIN areas a ON l.area_id = a.id
         WHERE ti.task_id = $1 AND ti.item_type = 'Line'`,
        [taskIdFromTask]
      );
      response.data.upvLines.items = lineRows.map((line) => ({
        id: line.id.toString(),
        line_number: line.line_number,
        project_id: line.project_id.toString(),
        project_name: line.project_name,
        area_number: line.area_number || "N/A",
      }));
      response.data.upvLines.count = lineRows.length;

      const { rows: equipRows } = await db.query(
        `SELECT e.id, e.equipment_number AS equipment_name, e.project_id, pr.name AS project_name, a.name AS area_number
         FROM task_items ti
         JOIN equipment e ON ti.item_id = e.id
         JOIN projects pr ON e.project_id = pr.id
         LEFT JOIN areas a ON e.area_id = a.id
         WHERE ti.task_id = $1 AND ti.item_type = 'Equipment'`,
        [taskIdFromTask]
      );
      response.data.upvEquipment.items = equipRows.map((equip) => ({
        id: equip.id.toString(),
        equipment_name: equip.equipment_name,
        project_id: equip.project_id.toString(),
        project_name: equip.project_name,
        area_number: equip.area_number || "N/A",
      }));
      response.data.upvEquipment.count = equipRows.length;
    } else if (taskType === "QC") {
      const { rows: lineRows } = await db.query(
        `SELECT l.id, l.line_number, l.project_id, pr.name AS project_name, a.name AS area_number
         FROM task_items ti
         JOIN lines l ON ti.item_id = l.id
         JOIN projects pr ON l.project_id = pr.id
         LEFT JOIN areas a ON l.area_id = a.id
         WHERE ti.task_id = $1 AND ti.item_type = 'Line'`,
        [taskIdFromTask]
      );
      response.data.qcLines.items = lineRows.map((line) => ({
        id: line.id.toString(),
        line_number: line.line_number,
        project_id: line.project_id.toString(),
        project_name: line.project_name,
        area_number: line.area_number || "N/A",
      }));
      response.data.qcLines.count = lineRows.length;

      const { rows: equipRows } = await db.query(
        `SELECT e.id, e.equipment_number AS equipment_name, e.project_id, pr.name AS project_name, a.name AS area_number
         FROM task_items ti
         JOIN equipment e ON ti.item_id = e.id
         JOIN projects pr ON e.project_id = pr.id
         LEFT JOIN areas a ON e.area_id = a.id
         WHERE ti.task_id = $1 AND ti.item_type = 'Equipment'`,
        [taskIdFromTask]
      );
      response.data.qcEquipment.items = equipRows.map((equip) => ({
        id: equip.id.toString(),
        equipment_name: equip.equipment_name,
        project_id: equip.project_id.toString(),
        project_name: equip.project_name,
        area_number: equip.area_number || "N/A",
      }));
      response.data.qcEquipment.count = equipRows.length;
    }

    console.log("Final API Response:", response);
    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching assigned items:", error.message, error.stack);
    res.status(500).json({
      message: "Failed to fetch assigned items",
      error: error.message,
    });
  }
});

// Get specific user (Admin only)
router.get("/:id", authorize(["Admin"]), getUserById);

module.exports = router;