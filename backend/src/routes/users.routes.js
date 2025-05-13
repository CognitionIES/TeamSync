const express = require("express");
const {
  getUsers,
  getUserById,
  getUsersByRole,
  getTeamMembers,
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
router.get("/team-members", authorize(["Team Lead"]), getTeamMembers);

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
    if (!["Team Lead", "Admin", "Project Manager"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Not authorized to view assigned items" });
    }

    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

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

    // Fetch task items
    const { rows: taskItems } = await db.query(
      "SELECT item_id, item_type, item_name FROM task_items WHERE task_id = $1",
      [taskIdFromTask]
    );

    for (const item of taskItems) {
      const { item_id, item_type, item_name } = item;

      if (item_type === "Line") {
        const { rows: lineRows } = await db.query(
          "SELECT id, line_number, project_id FROM lines WHERE id = $1",
          [item_id]
        );
        const line = lineRows[0];
        if (line) {
          const lineData = {
            id: line.id.toString(),
            line_number: line.line_number,
            project_id: line.project_id.toString(),
          };

          if (taskType === "UPV") {
            response.data.upvLines.items.push(lineData);
            response.data.upvLines.count++;
          } else if (taskType === "QC") {
            response.data.qcLines.items.push(lineData);
            response.data.qcLines.count++;
          }
        }
      } else if (item_type === "PID") {
        const { rows: pidRows } = await db.query(
          "SELECT id, pid_number, project_id FROM pids WHERE id = $1",
          [item_id]
        );
        const pid = pidRows[0];
        if (pid && taskType === "Redline") {
          const pidData = {
            id: pid.id.toString(),
            pid_number: pid.pid_number,
            project_id: pid.project_id.toString(),
          };
          response.data.redlinePIDs.items.push(pidData);
          response.data.redlinePIDs.count++;
        }
      } else if (item_type === "Equipment") {
        const { rows: equipRows } = await db.query(
          "SELECT id, equipment_number AS equipment_name, project_id FROM equipment WHERE id = $1",
          [item_id]
        );
        const equip = equipRows[0];
        if (equip) {
          const equipData = {
            id: equip.id.toString(),
            equipment_name: equip.equipment_name,
            project_id: equip.project_id.toString(),
          };

          if (taskType === "UPV") {
            response.data.upvEquipment.items.push(equipData);
            response.data.upvEquipment.count++;
          } else if (taskType === "QC") {
            response.data.qcEquipment.items.push(equipData);
            response.data.qcEquipment.count++;
          }
        }
      }
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching assigned items:", error.message, error.stack);
    res
      .status(500)
      .json({
        message: "Failed to fetch assigned items",
        error: error.message,
      });
  }
});
// Get specific user (Admin only)
router.get("/:id", authorize(["Admin"]), getUserById);

module.exports = router;
