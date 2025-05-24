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

    const projectIdNum = parseInt(projectId, 10);
    if (isNaN(projectIdNum)) {
      return res
        .status(400)
        .json({ message: "projectId must be a valid number" });
    }

    if (req.user.role !== "Team Lead") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to view unassigned lines`,
      });
    }

    const projectCheck = await db.query(
      "SELECT id FROM projects WHERE id = $1",
      [projectIdNum]
    );
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

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
});

// @desc    Create multiple lines in a batch
// @route   POST /api/lines/batch
// @access  Private
router.post("/batch", protect, async (req, res) => {
  try {
    const { lines } = req.body;

    if (!Array.isArray(lines) || lines.length === 0) {
      return res
        .status(400)
        .json({ message: "Lines array is required and must not be empty" });
    }

    await db.query("BEGIN");

    const createdLines = [];
    const auditLogEntries = [];
    const now = new Date();

    for (const line of lines) {
      const { line_number, description, type_id, pid_id, project_id } = line;

      if (!line_number || !pid_id || !project_id) {
        await db.query("ROLLBACK");
        return res
          .status(400)
          .json({
            message:
              "Line number, P&ID ID, and project ID are required for each line",
          });
      }

      const projectIdNum = parseInt(project_id, 10);
      const pidIdNum = parseInt(pid_id, 10);
      const typeIdNum = parseInt(type_id, 10);

      if (isNaN(projectIdNum) || isNaN(pidIdNum) || isNaN(typeIdNum)) {
        await db.query("ROLLBACK");
        return res
          .status(400)
          .json({ message: "Invalid numeric fields in one of the lines" });
      }

      const projectCheck = await db.query(
        "SELECT id FROM projects WHERE id = $1",
        [projectIdNum]
      );
      if (projectCheck.rows.length === 0) {
        await db.query("ROLLBACK");
        return res
          .status(400)
          .json({ message: "Invalid project ID in one of the lines" });
      }

      const pidCheck = await db.query(
        "SELECT id FROM pids WHERE id = $1 AND project_id = $2",
        [pidIdNum, projectIdNum]
      );
      if (pidCheck.rows.length === 0) {
        await db.query("ROLLBACK");
        return res
          .status(400)
          .json({
            message: "Invalid P&ID ID for this project in one of the lines",
          });
      }

      const { rows } = await db.query(
        "INSERT INTO lines (line_number, description, type_id, pid_id, project_id, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [line_number, description, typeIdNum, pidIdNum, projectIdNum, now]
      );

      createdLines.push(rows[0]);

      if (req.user) {
        auditLogEntries.push([
          "Line Creation",
          line_number,
          req.user.id,
          `Line ${line_number}`,
          now,
        ]);
      }
    }

    // Batch insert audit logs
    if (auditLogEntries.length > 0) {
      const values = auditLogEntries
        .map(
          (_, i) =>
            `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${
              i * 5 + 5
            })`
        )
        .join(", ");
      const flatValues = auditLogEntries.flat();
      await db.query(
        `INSERT INTO audit_logs (type, name, created_by_id, current_work, timestamp) VALUES ${values}`,
        flatValues
      );
    }

    await db.query("COMMIT");
    res.status(201).json({ data: createdLines });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Error creating lines batch:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @desc    Create a new line (kept for backward compatibility)
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

// @desc    Assign multiple lines to a team member in a batch
// @route   PUT /api/lines/assign/batch
// @access  Private (Team Lead)
router.put("/assign/batch", protect, async (req, res) => {
  try {
    const { lineIds, userId } = req.body;

    if (
      !Array.isArray(lineIds) ||
      lineIds.length === 0 ||
      !userId ||
      isNaN(parseInt(userId))
    ) {
      return res
        .status(400)
        .json({ message: "lineIds array and userId are required" });
    }

    if (req.user.role !== "Team Lead") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to assign lines`,
      });
    }

    await db.query("BEGIN");

    // Verify the user exists and is a team member under the current Team Lead
    const { rows: userRows } = await db.query(
      "SELECT * FROM users WHERE id = $1",
      [userId]
    );
    if (userRows.length === 0) {
      await db.query("ROLLBACK");
      return res.status(404).json({ message: "Team member not found" });
    }

    const { rows: teamMemberRows } = await db.query(
      "SELECT * FROM team_members WHERE member_id = $1 AND lead_id = $2",
      [userId, req.user.id]
    );
    if (teamMemberRows.length === 0) {
      await db.query("ROLLBACK");
      return res
        .status(403)
        .json({ message: "User is not a team member under your lead" });
    }

    // Verify all lines exist
    const lineIdPlaceholders = lineIds.map((_, i) => `$${i + 1}`).join(", ");
    const { rows: lineRows } = await db.query(
      `SELECT id FROM lines WHERE id IN (${lineIdPlaceholders})`,
      lineIds
    );

    if (lineRows.length !== lineIds.length) {
      await db.query("ROLLBACK");
      return res.status(404).json({ message: "One or more lines not found" });
    }

    // Batch update lines
    const updateQuery = `
      UPDATE lines 
      SET assigned_to_id = $${
        lineIds.length + 1
      }, updated_at = CURRENT_TIMESTAMP 
      WHERE id IN (${lineIdPlaceholders}) 
      RETURNING *
    `;
    const { rows: updatedRows } = await db.query(updateQuery, [
      ...lineIds,
      userId,
    ]);

    await db.query("COMMIT");
    res.status(200).json({ data: updatedRows });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Error assigning lines batch:", error.stack);
    res
      .status(500)
      .json({ message: "Failed to assign lines", error: error.message });
  }
});

// @desc    Assign a line to a team member (kept for backward compatibility)
// @route   PUT /api/lines/:id/assign
// @access  Private (Team Lead)
router.put("/:id/assign", protect, async (req, res) => {
  try {
    const lineId = parseInt(req.params.id);
    const { userId } = req.body;

    if (isNaN(lineId)) {
      return res.status(400).json({ message: "Invalid line ID" });
    }
    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({ message: "Invalid team member ID" });
    }

    const { rows: lineRows } = await db.query(
      "SELECT * FROM lines WHERE id = $1",
      [lineId]
    );
    if (lineRows.length === 0) {
      return res.status(404).json({ message: "Line not found" });
    }

    const { rows: userRows } = await db.query(
      "SELECT * FROM users WHERE id = $1",
      [userId]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ message: "Team member not found" });
    }

    const { rows: teamMemberRows } = await db.query(
      "SELECT * FROM team_members WHERE member_id = $1 AND lead_id = $2",
      [userId, req.user.id]
    );
    if (teamMemberRows.length === 0) {
      return res
        .status(403)
        .json({ message: "User is not a team member under your lead" });
    }

    const { rows: updatedRows } = await db.query(
      "UPDATE lines SET assigned_to_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
      [userId, lineId]
    );

    res.status(200).json({ data: updatedRows[0] });
  } catch (error) {
    console.error("Error assigning line:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to assign line", error: error.message });
  }
});

// @desc    Get lines assigned to the current team member
// @route   GET /api/lines/assigned
// @access  Private (Team Member)
router.get("/assigned", protect, async (req, res) => {
  try {
    if (req.user.role !== "Team Member") {
      return res
        .status(403)
        .json({ message: "Only Team Members can access assigned lines" });
    }

    const query = `
      SELECT l.id, l.line_number, l.pid_id, p.pid_number, l.project_id
      FROM lines l
      JOIN pids p ON l.pid_id = p.id
      WHERE l.assigned_to_id = $1
    `;
    const { rows } = await db.query(query, [req.user.id]);
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching assigned lines:", error.message, error.stack);
    res
      .status(500)
      .json({
        message: "Failed to fetch assigned lines",
        error: error.message,
      });
  }
});

module.exports = router;
