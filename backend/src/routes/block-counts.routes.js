const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// Get block count for a specific item
router.get("/:itemType/:itemId", protect, async (req, res) => {
  try {
    const { itemType, itemId } = req.params;

    const validItemTypes = ["Line", "Equipment", "NonInlineInstrument", "PID"];
    if (!validItemTypes.includes(itemType)) {
      return res.status(400).json({ message: "Invalid item type" });
    }

    // Get block count from task_items
    const { rows } = await db.query(
      `SELECT ti.blocks, ti.completed, ti.completed_at, u.name as completed_by_name
       FROM task_items ti
       LEFT JOIN tasks t ON ti.task_id = t.id
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE ti.item_id = $1 AND ti.item_type = $2 AND ti.completed = true
       ORDER BY ti.completed_at DESC
       LIMIT 1`,
      [itemId, itemType]
    );

    if (rows.length === 0) {
      return res.status(200).json({
        data: {
          blocks: 0,
          completed: false,
          completed_by_name: null,
          completed_at: null,
        },
      });
    }

    res.status(200).json({ data: rows[0] });
  } catch (error) {
    console.error("Error fetching block count:", error);
    res.status(500).json({
      message: "Failed to fetch block count",
      error: error.message,
    });
  }
});

module.exports = router;
