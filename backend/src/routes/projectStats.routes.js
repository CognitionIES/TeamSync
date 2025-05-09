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

    const [pidResult, lineResult, equipmentResult] = await Promise.all([
      db.query("SELECT COUNT(*) FROM pids"),
      db.query("SELECT COUNT(*) FROM lines"),
      db.query("SELECT COUNT(*) FROM equipment"),
    ]);

    const stats = {
      pidCount: parseInt(pidResult.rows[0].count, 10),
      lineCount: parseInt(lineResult.rows[0].count, 10),
      equipmentCount: parseInt(equipmentResult.rows[0].count, 10),
    };

    console.log("Project stats fetched for Admin:", stats);
    res.status(200).json({ data: stats });
  } catch (error) {
    console.error("Error fetching project stats:", error.message, error.stack);
    res.status(500).json({ message: "Failed to fetch project stats", error: error.message });
  }
});

module.exports = router;