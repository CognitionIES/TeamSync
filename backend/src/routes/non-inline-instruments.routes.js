const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// GET /api/non-inline-instruments/unassigned/:projectId
// Fetch unassigned non-inline instruments for a project
router.get("/unassigned/:projectId", protect, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const query = `
      SELECT 
        ni.id,
        ni.instrument_tag,
        ni.description
      FROM non_inline_instruments ni
      LEFT JOIN task_items ti ON ni.id = ti.item_id AND ti.item_type = 'NonInlineInstrument'
      WHERE ni.project_id = $1
        AND ti.id IS NULL
    `;
    const { rows } = await db.query(query, [projectId]);
    console.log(
      `Fetched unassigned non-inline instruments for project ${projectId}:`,
      rows
    );

    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching unassigned non-inline instruments:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });
    res.status(500).json({
      message: "Failed to fetch unassigned non-inline instruments",
      error: error.message,
    });
  }
});

// PUT /api/non-inline-instruments/assign/batch
// Assign multiple non-inline instruments to a user via a task
// PUT /api/non-inline-instruments/assign/batch
router.put("/assign/batch", protect, async (req, res) => {
  try {
    const { instrumentIds, userId, taskId } = req.body;

    if (!Array.isArray(instrumentIds) || instrumentIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Instrument IDs must be a non-empty array" });
    }
    if (!userId || !taskId) {
      return res
        .status(400)
        .json({ message: "User ID and Task ID are required" });
    }

    await db.query("BEGIN");

    // Verify the task exists and is assigned to the user
    const taskCheck = await db.query(
      "SELECT id FROM tasks WHERE id = $1 AND assignee_id = $2",
      [taskId, userId]
    );
    if (taskCheck.rows.length === 0) {
      await db.query("ROLLBACK");
      return res
        .status(404)
        .json({ message: "Task not found or not assigned to the user" });
    }

    // Insert each instrument as a task item
    const insertQuery = `
      INSERT INTO task_items (task_id, name, item_type, item_id, completed)
      VALUES ($1, $2, 'NonInlineInstrument', $3, false)
      RETURNING id
    `;
    for (const instrumentId of instrumentIds) {
      const instrument = await db.query(
        "SELECT instrument_tag FROM non_inline_instruments WHERE id = $1",
        [instrumentId]
      );
      if (instrument.rows.length === 0) {
        await db.query("ROLLBACK");
        return res
          .status(404)
          .json({ message: `Instrument with ID ${instrumentId} not found` });
      }
      const itemName = instrument.rows[0].instrument_tag;
      await db.query(insertQuery, [taskId, itemName, instrumentId]);
    }

    await db.query("COMMIT");
    console.log(
      `Assigned ${instrumentIds.length} non-inline instruments to task ${taskId}`
    );

    res
      .status(200)
      .json({ message: "Non-inline instruments assigned successfully" });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Error assigning non-inline instruments:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      message: "Failed to assign non-inline instruments",
      error: error.message,
    });
  }
});

module.exports = router;
