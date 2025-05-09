const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// GET /api/tasks - Fetch tasks based on user role
router.get("/", protect, async (req, res) => {
  try {
    console.log("User role:", req.user.role);
    console.log("User ID:", req.user.id);

    if (req.user.role === "Project Manager") {
      console.log("Fetching all tasks for Project Manager...");
      const query = `
        SELECT t.id, t.type, u.name as assignee, t.assignee_id, t.status, t.is_complex,
               t.created_at, t.updated_at, t.completed_at, t.progress,
               json_agg(json_build_object('id', ti.id, 'name', ti.name)) as items,
               json_agg(json_build_object('id', tc.id, 'text', tc.text)) as comments
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        LEFT JOIN task_items ti ON t.id = ti.task_id
        LEFT JOIN task_comments tc ON t.id = tc.task_id
        GROUP BY t.id, u.name
      `;
      const { rows } = await db.query(query);
      console.log("Tasks fetched for Project Manager:", rows);
      res.status(200).json({ data: rows });
    } else if (req.user.role === "Team Member") {
      console.log("Fetching tasks for Team Member ID:", req.user.id);
      const query = `
        SELECT t.id, t.type, u.name as assignee, t.assignee_id, t.status, t.is_complex,
               t.created_at, t.updated_at, t.completed_at, t.progress,
               json_agg(json_build_object('id', ti.id, 'name', ti.name)) as items,
               json_agg(json_build_object('id', tc.id, 'text', tc.text)) as comments
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        LEFT JOIN task_items ti ON t.id = ti.task_id
        LEFT JOIN task_comments tc ON t.id = tc.task_id
        WHERE t.assignee_id = $1
        GROUP BY t.id, u.name
      `;
      const { rows } = await db.query(query, [req.user.id]);
      console.log("Tasks fetched for Team Member:", rows);
      res.status(200).json({ data: rows });
    } else {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to view tasks`,
      });
    }
  } catch (error) {
    console.error("Error fetching tasks:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to fetch tasks", error: error.message });
  }
});

module.exports = router;
