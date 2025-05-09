const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// GET /api/task-status - Fetch task status breakdown
router.get("/", protect, async (req, res) => {
  try {
    console.log("User role:", req.user.role);
    console.log("User ID:", req.user.id);

    if (req.user.role === "Admin") {
      console.log("Fetching task status for Admin...");
      const { project, team } = req.query;
      let query = `
        SELECT status, COUNT(*) as count
        FROM tasks t
      `;
      const conditions = [];
      const values = [];

      if (project && project !== "all") {
        query += `
          JOIN projects p ON t.project_id = p.id
        `;
        conditions.push(`p.name = $${values.length + 1}`);
        values.push(project);
      }
      if (team && team !== "all") {
        query += `
          JOIN users u ON t.assignee_id = u.id
          JOIN team_members tm ON tm.member_id = u.id
        `;
        conditions.push(`tm.team_name = $${values.length + 1}`);
        values.push(team);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
      query += " GROUP BY status";

      const { rows } = await db.query(query, values);

      const statusCounts = {
        assigned: 0,
        inProgress: 0,
        completed: 0,
      };

      rows.forEach((row) => {
        if (row.status === "Assigned")
          statusCounts.assigned = parseInt(row.count, 10);
        else if (row.status === "In Progress")
          statusCounts.inProgress = parseInt(row.count, 10);
        else if (row.status === "Completed")
          statusCounts.completed = parseInt(row.count, 10);
      });

      console.log("Task status fetched for Admin:", statusCounts);
      res.status(200).json({ data: statusCounts });
    } else if (req.user.role === "Team Lead") {
      console.log("Fetching task status for Team Lead ID:", req.user.id);
      const { project } = req.query;
      let query = `
        SELECT status, COUNT(*) as count
        FROM tasks t
        JOIN users u ON t.assignee_id = u.id
        JOIN team_members tm ON tm.member_id = u.id
        WHERE tm.lead_id = $1
      `;
      const values = [req.user.id];
      const conditions = [];

      if (project && project !== "all") {
        query += `
          JOIN projects p ON t.project_id = p.id
        `;
        conditions.push(`p.name = $${values.length + 1}`);
        values.push(project);
      }

      if (conditions.length > 0) {
        query += " AND " + conditions.join(" AND ");
      }
      query += " GROUP BY status";

      const { rows } = await db.query(query, values);

      const statusCounts = {
        assigned: 0,
        inProgress: 0,
        completed: 0,
      };

      rows.forEach((row) => {
        if (row.status === "Assigned")
          statusCounts.assigned = parseInt(row.count, 10);
        else if (row.status === "In Progress")
          statusCounts.inProgress = parseInt(row.count, 10);
        else if (row.status === "Completed")
          statusCounts.completed = parseInt(row.count, 10);
      });

      console.log("Task status fetched for Team Lead:", statusCounts);
      res.status(200).json({ data: statusCounts });
    } else {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to view task status`,
      });
    }
  } catch (error) {
    console.error("Error fetching task status:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to fetch task status", error: error.message });
  }
});

module.exports = router;
