const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// @desc    Get all P&IDs
// @route   GET /api/pids
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM pids");
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching P&IDs:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @desc    Get all P&IDs for an area
// @route   GET /api/pids/area/:areaId
// @access  Private
router.get("/area/:areaId", protect, async (req, res) => {
  try {
    const { areaId } = req.params;
    const { rows } = await db.query("SELECT * FROM pids WHERE area_id = $1", [
      areaId,
    ]);
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching P&IDs for area:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @desc    Create a new P&ID
// @route   POST /api/pids
// @access  Private
router.post("/", protect, async (req, res) => {
  console.log("Using updated pids.routes.js with pid_number");
  try {
    console.log("Creating P&ID with body:", req.body);
    const { pidNumber, description, areaId, projectId } = req.body;
    if (!pidNumber || !projectId) {
      return res
        .status(400)
        .json({ message: "P&ID number and project ID are required" });
    }

    // Verify projectId exists
    const projectCheck = await db.query(
      "SELECT id FROM projects WHERE id = $1",
      [projectId]
    );
    if (projectCheck.rows.length === 0) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    // Verify areaId if provided
    if (areaId) {
      const areaCheck = await db.query(
        "SELECT id FROM areas WHERE id = $1 AND project_id = $2",
        [areaId, projectId]
      );
      if (areaCheck.rows.length === 0) {
        return res
          .status(400)
          .json({ message: "Invalid area ID for this project" });
      }
    }

    const { rows } = await db.query(
      "INSERT INTO pids (pid_number, description, area_id, project_id, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [pidNumber, description, areaId || null, projectId, new Date()]
    );

    // Log the action in audit logs
    if (req.user) {
      console.log("Logging audit for user:", req.user.userId);
      await db.query(
        "INSERT INTO audit_logs (type, name, created_by_id, current_work, timestamp) VALUES ($1, $2, $3, $4, $5)",
        [
          "P&ID Creation",
          pidNumber,
          req.user.userId,
          `P&ID ${pidNumber}`,
          new Date(),
        ]
      );
    } else {
      console.warn("No user found for audit logging");
    }

    res.status(201).json({ data: rows[0] });
  } catch (error) {
    console.error("Error creating P&ID:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
