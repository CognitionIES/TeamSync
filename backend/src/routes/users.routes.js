const express = require("express");
const {
  getUserById,
  getUsersByRole,
  getUserByName,
} = require("../controllers/users.controller");
const { protect, authorize } = require("../middleware/auth");
const db = require("../config/db");

const router = express.Router();

// Public test route to fetch all users (no authentication required)
router.get("/test", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM users");
    res.status(200).json({ message: "Database query successful", data: rows });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Database query failed", error: error.message });
  }
});

// Public route to fetch users by role (needed for login page dropdown)
router.get("/role/:role", getUsersByRole);

// All routes below are protected
router.use(protect);

// Fetch team members (for Team Lead dashboard dropdown)
router.get("/team-members", authorize(["Team Lead"]), async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("No user ID found in request. User:", req.user);
      return res
        .status(401)
        .json({ message: "User authentication failed. Please log in again." });
    }

    console.log("Fetching team members for Team Lead ID:", req.user.id);
    console.log("User role:", req.user.role);
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
    console.log("Team members fetched:", rows);
    if (rows.length === 0) {
      console.log("No team members found for Team Lead ID:", req.user.id);
      return res.status(200).json({
        data: [],
        message:
          "No team members found for this Team Lead. Please contact an Admin to assign team members.",
      });
    }
    res.status(200).json({ data: rows });
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
        `
        SELECT id, name, role
        FROM users
        `
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
        `
        SELECT id, name, role
        FROM users
        WHERE id = $1
        `,
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
    res
      .status(500)
      .json({ message: "Failed to fetch users", error: error.message });
  }
});

// New route: Fetch assigned items for a specific user
router.get("/:userId/assigned-items/:taskId", async (req, res) => {
  console.log(
    `Received request for /api/users/${req.params.userId}/assigned-items/${req.params.taskId}`
  );
  try {
    // Role-based access control
    if (!["Team Lead", "Admin", "Project Manager"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Not authorized to view assigned items" });
    }

    // Validate userId and taskId
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    // Team Lead access control: ensure user is a team member under this lead
    if (req.user.role === "Team Lead") {
      console.log(
        `Checking team member relationship: member_id=${userId}, lead_id=${req.user.id}`
      );
      const { rows: teamMemberCheck } = await db.query(
        "SELECT 1 FROM team_members WHERE member_id = $1 AND lead_id = $2",
        [userId, req.user.id]
      );
      if (teamMemberCheck.length === 0) {
        return res
          .status(403)
          .json({ message: "User is not a team member under this lead" });
      }
    }

    // Fetch the specific task for the user
    const { rows: tasks } = await db.query(
      "SELECT id, type FROM tasks WHERE assignee_id = $1 AND id = $2",
      [userId, taskId]
    );
    if (tasks.length === 0) {
      return res.status(404).json({ message: "Task not found for this user" });
    }

    // Initialize response structure
    const response = {
      data: {
        upvLines: { count: 0, items: [] },
        qcLines: { count: 0, items: [] },
        redlinePIDs: { count: 0, items: [] },
        upvEquipment: { count: 0, items: [] },
        qcEquipment: { count: 0, items: [] },
      },
    };

    // Process the single task
    const task = tasks[0];
    const taskIdFromTask = task.id;
    const taskType = task.type;

    console.log(
      `Fetching items for task ${taskIdFromTask} (type: ${taskType})`
    );

    // Fetch items based on task type using JOINs to avoid item_name dependency
    if (taskType === "Redline") {
      const { rows: pidRows } = await db.query(
        `
        SELECT p.id, p.pid_number, p.project_id
        FROM task_items ti
        JOIN pids p ON ti.item_id = p.id
        WHERE ti.task_id = $1 AND ti.item_type = 'PID'
      `,
        [taskIdFromTask]
      );
      response.data.redlinePIDs.items = pidRows.map((pid) => ({
        id: pid.id.toString(),
        pid_number: pid.pid_number,
        project_id: pid.project_id.toString(),
      }));
      response.data.redlinePIDs.count = pidRows.length;
    } else if (taskType === "UPV") {
      const { rows: lineRows } = await db.query(
        `
        SELECT l.id, l.line_number, l.project_id
        FROM task_items ti
        JOIN lines l ON ti.item_id = l.id
        WHERE ti.task_id = $1 AND ti.item_type = 'Line'
      `,
        [taskIdFromTask]
      );
      response.data.upvLines.items = lineRows.map((line) => ({
        id: line.id.toString(),
        line_number: line.line_number,
        project_id: line.project_id.toString(),
      }));
      response.data.upvLines.count = lineRows.length;

      const { rows: equipRows } = await db.query(
        `
        SELECT e.id, e.equipment_number AS equipment_name, e.project_id
        FROM task_items ti
        JOIN equipment e ON ti.item_id = e.id
        WHERE ti.task_id = $1 AND ti.item_type = 'Equipment'
      `,
        [taskIdFromTask]
      );
      response.data.upvEquipment.items = equipRows.map((equip) => ({
        id: equip.id.toString(),
        equipment_name: equip.equipment_name,
        project_id: equip.project_id.toString(),
      }));
      response.data.upvEquipment.count = equipRows.length;
    } else if (taskType === "QC") {
      const { rows: lineRows } = await db.query(
        `
        SELECT l.id, l.line_number, l.project_id
        FROM task_items ti
        JOIN lines l ON ti.item_id = l.id
        WHERE ti.task_id = $1 AND ti.item_type = 'Line'
      `,
        [taskIdFromTask]
      );
      response.data.qcLines.items = lineRows.map((line) => ({
        id: line.id.toString(),
        line_number: line.line_number,
        project_id: line.project_id.toString(),
      }));
      response.data.qcLines.count = lineRows.length;

      const { rows: equipRows } = await db.query(
        `
        SELECT e.id, e.equipment_number AS equipment_name, e.project_id
        FROM task_items ti
        JOIN equipment e ON ti.item_id = e.id
        WHERE ti.task_id = $1 AND ti.item_type = 'Equipment'
      `,
        [taskIdFromTask]
      );
      response.data.qcEquipment.items = equipRows.map((equip) => ({
        id: equip.id.toString(),
        equipment_name: equip.equipment_name,
        project_id: equip.project_id.toString(),
      }));
      response.data.qcEquipment.count = equipRows.length;
    }

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
