const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

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
    console.error("Error fetching P&IDs for area:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @desc    Create a new P&ID
// @route   POST /api/pids
// @access  Private
router.post("/", protect, async (req, res) => {
  try {
    const { pidNumber, description, areaId, projectId } = req.body;
    if (!pidNumber || !projectId) {
      return res
        .status(400)
        .json({ message: "P&ID number and project ID are required" });
    }

    const { rows } = await db.query(
      "INSERT INTO pids (name, description, area_id, project_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [pidNumber, description, areaId || null, projectId]
    );

    // Log the action in audit logs
    if (req.user) {
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
    }

    res.status(201).json({ data: rows[0] });
  } catch (error) {
    console.error("Error creating P&ID:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
