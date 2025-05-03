const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// @desc    Create a new line
// @route   POST /api/lines
// @access  Private
router.post("/", protect, async (req, res) => {
  try {
    const { lineNumber, description, typeId, pidId, projectId } = req.body;
    if (!lineNumber || !pidId || !projectId) {
      return res
        .status(400)
        .json({ message: "Line number, P&ID ID, and project ID are required" });
    }

    const { rows } = await db.query(
      "INSERT INTO lines (line_number, description, type_id, pid_id, project_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [lineNumber, description || null, typeId || null, pidId, projectId]
    );

    // Log the action in audit logs
    if (req.user) {
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
    }

    res.status(201).json({ data: rows[0] });
  } catch (error) {
    console.error("Error creating line:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
