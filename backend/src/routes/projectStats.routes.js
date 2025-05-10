const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// GET /api/project-stats - Fetch project statistics
router.get("/", protect, async (req, res) => {
  try {
    console.log("User role:", req.user.role);
    console.log("User ID:", req.user.id);

    if (req.user.role !== "Admin") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to view project stats`,
      });
    }

    const { project, team } = req.query;

    let pidQuery = `SELECT COUNT(*) FROM pids`;
    let lineQuery = `SELECT COUNT(*) FROM lines`;
    let equipmentQuery = `SELECT COUNT(*) FROM equipment`;
    const values = [];
    const conditions = [];

    if (project && project !== "all") {
      conditions.push(`project_name = $${values.length + 1}`);
      values.push(project);
    }

    if (team && team !== "all") {
      // Use LEFT JOIN to make the joins optional
      pidQuery += `
        LEFT JOIN tasks t ON t.project_name = pids.project_name
        LEFT JOIN team_members tm ON t.assignee_id = tm.member_id
        LEFT JOIN users u ON tm.lead_id = u.id
      `;
      lineQuery += `
        LEFT JOIN tasks t ON t.project_name = lines.project_name
        LEFT JOIN team_members tm ON t.assignee_id = tm.member_id
        LEFT JOIN users u ON tm.lead_id = u.id
      `;
      equipmentQuery += `
        LEFT JOIN tasks t ON t.project_name = equipment.project_name
        LEFT JOIN team_members tm ON t.assignee_id = tm.member_id
        LEFT JOIN users u ON tm.lead_id = u.id
      `;
      conditions.push(`u.name = $${values.length + 1}`);
      values.push(team);
    }

    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(" AND ")}`;
      pidQuery += whereClause;
      lineQuery += whereClause;
      equipmentQuery += whereClause;
    }

    const [pidResult, lineResult, equipmentResult] = await Promise.all([
      db.query(pidQuery, values),
      db.query(lineQuery, values),
      db.query(equipmentQuery, values),
    ]);

    const stats = {
      pidCount: parseInt(pidResult.rows[0].count, 10) || 0,
      lineCount: parseInt(lineResult.rows[0].count, 10) || 0,
      equipmentCount: parseInt(equipmentResult.rows[0].count, 10) || 0,
    };

    console.log("Project stats fetched for Admin:", stats);
    res.status(200).json({ data: stats });
  } catch (error) {
    console.error("Error fetching project stats:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to fetch project stats", error: error.message });
  }
});

module.exports = router;
