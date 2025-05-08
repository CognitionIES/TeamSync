const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// @desc    Get all lines
// @route   GET /api/lines
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM lines");
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching lines:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @desc    Create a new line
// @route   POST /api/lines
// @access  Private
router.post("/", protect, async (req, res) => {
  try {
    console.log("Creating line with body:", req.body);
    const { lineNumber, description, typeId, pidId, projectId } = req.body;
    if (!lineNumber || !pidId || !projectId) {
      return res
        .status(400)
        .json({ message: "Line number, P&ID ID, and project ID are required" });
    }

    // Verify pidId exists
    const pidCheck = await db.query("SELECT id FROM pids WHERE id = $1", [
      pidId,
    ]);
    if (pidCheck.rows.length === 0) {
      return res.status(400).json({ message: "Invalid P&ID ID" });
    }

    // Verify projectId matches the P&ID's project
    const projectCheck = await db.query(
      "SELECT project_id FROM pids WHERE id = $1",
      [pidId]
    );
    if (
      projectCheck.rows.length === 0 ||
      projectCheck.rows[0].project_id != projectId
    ) {
      return res
        .status(400)
        .json({ message: "Project ID does not match P&ID's project" });
    }

    const { rows } = await db.query(
      "INSERT INTO lines (line_number, description, type_id, pid_id, project_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [lineNumber, description || null, typeId || null, pidId, projectId]
    );

    // Log the action in audit logs
    if (req.user) {
      console.log("Logging audit for user:", req.user.userId);
      await db.query(
        "INSERT INTO audit_logs (type, name, created_by_id, current_work, timestamp) VALUES ($1, $2, $3, $4, $5)",
        [
          "Line Creation",
          lineNumber,
          req.user.userId,
          `Line ${lineNumber}`,
          new Date(),
        ]
      );
    } else {
      console.warn("No user found for audit logging");
    }

    res.status(201).json({ data: rows[0] });
  } catch (error) {
    console.error("Error creating line:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
