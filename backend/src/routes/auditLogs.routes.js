const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// GET /api/audit-logs - Fetch audit logs
router.get("/", protect, async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to view audit logs`,
      });
    }

    const { project, team } = req.query;

    let query = `
      SELECT al.*, u.name as created_by
      FROM audit_logs al
      LEFT JOIN users u ON al.created_by_id = u.id
    `;
    const values = [];
    const conditions = [];

    if (project && project !== "all") {
      conditions.push(`al.project_name = $${values.length + 1}`);
      values.push(project);
    }

    if (team && team !== "all") {
      conditions.push(`al.team_name = $${values.length + 1}`);
      values.push(team);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY timestamp DESC`;

    const { rows } = await db.query(query, values);

    // Transform the response to match frontend expectations
    const transformedLogs = rows.map((log) => ({
      id: log.id,
      type: log.type,
      name: log.name,
      createdBy: log.created_by || "Unknown",
      currentWork: log.current_work,
      timestamp: log.timestamp,
      projectName: log.project_name,
      teamName: log.team_name,
    }));

    console.log("Fetched audit logs:", transformedLogs);
    res.status(200).json({ data: transformedLogs });
  } catch (error) {
    console.error("Error fetching audit logs:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to fetch audit logs", error: error.message });
  }
});

module.exports = router;
