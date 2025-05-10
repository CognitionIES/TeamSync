const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// @desc    Get all unassigned lines for a project
// @route   GET /api/lines/unassigned/:projectId
// @access  Private (Team Lead)
router.get("/unassigned/:projectId", protect, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Validate projectId
    const projectIdNum = parseInt(projectId, 10);
    if (isNaN(projectIdNum)) {
      return res
        .status(400)
        .json({ message: "projectId must be a valid number" });
    }

    // Check if the user has Team Lead role
    if (req.user.role !== "Team Lead") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to view unassigned lines`,
      });
    }

    // Verify project exists
    const projectCheck = await db.query(
      "SELECT id FROM projects WHERE id = $1",
      [projectIdNum]
    );
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Fetch unassigned lines (where assigned_to_id is NULL)
    const { rows } = await db.query(
      `
      SELECT lines.*, pids.pid_number AS pid_number
      FROM lines
      JOIN pids ON lines.pid_id = pids.id
      WHERE lines.project_id = $1 AND lines.assigned_to_id IS NULL
      `,
      [projectIdNum]
    );

    if (rows.length === 0) {
      return res
        .status(200)
        .json({ data: [], message: "No unassigned lines found" });
    }

    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching unassigned lines:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
}); // @desc    Create a new line (already implemented)
// @route   POST /api/lines
// @access  Private
router.post("/", protect, async (req, res) => {
  try {
    console.log("Creating line with body:", req.body);
    const { line_number, description, type_id, pid_id, project_id } = req.body;

    if (!line_number || !pid_id || !project_id) {
      return res
        .status(400)
        .json({ message: "Line number, P&ID ID, and project ID are required" });
    }

    const projectIdNum = parseInt(project_id, 10);
    const pidIdNum = parseInt(pid_id, 10);
    const typeIdNum = parseInt(type_id, 10);

    if (isNaN(projectIdNum) || isNaN(pidIdNum) || isNaN(typeIdNum)) {
      return res.status(400).json({ message: "Invalid numeric fields" });
    }

    const projectCheck = await db.query(
      "SELECT id FROM projects WHERE id = $1",
      [projectIdNum]
    );
    if (projectCheck.rows.length === 0) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const pidCheck = await db.query(
      "SELECT id FROM pids WHERE id = $1 AND project_id = $2",
      [pidIdNum, projectIdNum]
    );
    if (pidCheck.rows.length === 0) {
      return res
        .status(400)
        .json({ message: "Invalid P&ID ID for this project" });
    }

    const { rows } = await db.query(
      "INSERT INTO lines (line_number, description, type_id, pid_id, project_id, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [line_number, description, typeIdNum, pidIdNum, projectIdNum, new Date()]
    );

    if (req.user) {
      await db.query(
        "INSERT INTO audit_logs (type, name, created_by_id, current_work, timestamp) VALUES ($1, $2, $3, $4, $5)",
        [
          "Line Creation",
          line_number,
          req.user.id,
          `Line ${line_number}`,
          new Date(),
        ]
      );
    }

    res.status(201).json({ data: rows[0] });
  } catch (error) {
    console.error("Error creating line:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});
// @desc    Assign a line to a team member
// @route   PUT /api/lines/:id/assign
// @access  Private (Team Lead)
router.put("/:id/assign", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { assigned_to_id } = req.body;

    // Validate inputs
    const lineIdNum = parseInt(id, 10);
    const assignedToIdNum = parseInt(assigned_to_id, 10);

    if (isNaN(lineIdNum) || isNaN(assignedToIdNum)) {
      return res
        .status(400)
        .json({ message: "Invalid line ID or team member ID" });
    }

    // Check if the user has Team Lead role
    if (req.user.role !== "Team Lead") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to assign lines`,
      });
    }

    // Verify the line exists and is unassigned
    const lineCheck = await db.query(
      "SELECT * FROM lines WHERE id = $1 AND assigned_to_id IS NULL",
      [lineIdNum]
    );
    if (lineCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Line not found or already assigned" });
    }

    // Verify the team member exists and has the Team Member role
    const userCheck = await db.query(
      "SELECT id FROM users WHERE id = $1 AND role = $2",
      [assignedToIdNum, "Team Member"]
    );
    if (userCheck.rows.length === 0) {
      return res.status(400).json({ message: "Invalid team member ID" });
    }

    // Update the line with the assigned_to_id
    const { rows } = await db.query(
      "UPDATE lines SET assigned_to_id = $1, updated_at = $2 WHERE id = $3 RETURNING *",
      [assignedToIdNum, new Date(), lineIdNum]
    );

    // Log the action in audit logs
    if (req.user) {
      await db.query(
        "INSERT INTO audit_logs (type, name, created_by_id, current_work, timestamp) VALUES ($1, $2, $3, $4, $5)",
        [
          "Line Assignment",
          lineCheck.rows[0].line_number,
          req.user.id,
          `Assigned to user ${assignedToIdNum}`,
          new Date(),
        ]
      );
    }

    res.status(200).json({ data: rows[0] });
  } catch (error) {
    console.error("Error assigning line:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});
module.exports = router;
