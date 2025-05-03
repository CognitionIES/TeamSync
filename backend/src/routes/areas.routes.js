const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// @desc    Get all areas for a project
// @route   GET /api/areas/project/:projectId
// @access  Private
router.get("/project/:projectId", protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { rows } = await db.query(
      "SELECT * FROM areas WHERE project_id = $1",
      [projectId]
    );
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching areas for project:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @desc    Create a new area
// @route   POST /api/areas
// @access  Private
router.post("/", protect, async (req, res) => {
  try {
    const { name, projectId } = req.body;
    if (!name || !projectId) {
      return res
        .status(400)
        .json({ message: "Name and project ID are required" });
    }

    const { rows } = await db.query(
      "INSERT INTO areas (name, project_id) VALUES ($1, $2) RETURNING *",
      [name, projectId]
    );

    // Log the action in audit logs
    if (req.user) {
      await db.query(
        "INSERT INTO audit_logs (type, name, created_by_id, current_work, timestamp) VALUES ($1, $2, $3, $4, $5)",
        ["Area Creation", name, req.user.userId, `Area ${name}`, new Date()]
      );
    }

    res.status(201).json({ data: rows[0] });
  } catch (error) {
    console.error("Error creating area:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
