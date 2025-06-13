const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// @desc    Fetch unassigned non-inline instruments for a project
// @route   GET /api/non-inline-instruments/unassigned/:projectId
// @access  Private
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
      JOIN pids p ON ni.pid_id = p.id
      JOIN areas a ON p.area_id = a.id
      LEFT JOIN task_items ti ON ni.id = ti.item_id AND ti.item_type = 'NonInlineInstrument'
      WHERE a.project_id = $1
        AND ti.id IS NULL
        AND ni.assigned_to IS NULL
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
}); // @desc    Batch create non-inline instruments
// @route   POST /api/non-inline-instruments/batch
// @access  Private
router.post("/batch", protect, async (req, res) => {
  const client = await db.pool.connect(); // Fix: Use db.pool.connect()
  try {
    await client.query("BEGIN");

    const { instruments } = req.body;

    // Validate the request body
    if (
      !instruments ||
      !Array.isArray(instruments) ||
      instruments.length === 0
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Instruments are required and must be a non-empty array",
      });
    }

    // Validate each instrument object
    const requiredFields = ["instrumentTag", "areaId", "pidId", "description"];
    for (let i = 0; i < instruments.length; i++) {
      const instrument = instruments[i];
      for (const field of requiredFields) {
        if (instrument[field] === undefined || instrument[field] === null) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: `Missing or null required field '${field}' in instrument at index ${i}`,
          });
        }
      }
    }

    // Validate user
    if (!req.user || !req.user.id) {
      await client.query("ROLLBACK");
      return res.status(401).json({
        message: "User authentication failed: No user ID found",
      });
    }

    const { rows: userRows } = await client.query(
      "SELECT id FROM users WHERE id = $1",
      [req.user.id]
    );
    if (userRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `User ID ${req.user.id} does not exist in the users table`,
      });
    }

    const createdInstruments = [];
    for (const instrument of instruments) {
      const { instrumentTag, description, areaId, pidId } = instrument;

      // Convert areaId and pidId to integers
      const areaIdNum = parseInt(areaId, 10);
      const pidIdNum = parseInt(pidId, 10);

      if (isNaN(areaIdNum) || isNaN(pidIdNum)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "areaId and pidId must be valid numbers",
        });
      }

      // Validate areaId
      const { rows: areaRows } = await client.query(
        "SELECT id FROM areas WHERE id = $1",
        [areaIdNum]
      );
      if (areaRows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ message: `Area ID ${areaIdNum} not found` });
      }

      // Validate pidId and its association with areaId
      const { rows: pidRows } = await client.query(
        "SELECT id, project_id FROM pids WHERE id = $1 AND area_id = $2",
        [pidIdNum, areaIdNum]
      );
      if (pidRows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `PID ID ${pidIdNum} not found or not associated with Area ID ${areaIdNum}`,
        });
      }

      const projectId = pidRows[0].project_id;
      if (!projectId) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `Project ID not found for PID ID ${pidIdNum}`,
        });
      }

      // Insert the instrument
      const { rows } = await client.query(
        `
        INSERT INTO non_inline_instruments (
          instrument_tag, description, area_id, pid_id, project_id, created_by_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          instrumentTag,
          description,
          areaIdNum,
          pidIdNum,
          projectId,
          req.user.id,
          new Date(),
        ]
      );

      createdInstruments.push(rows[0]);
    }

    // Log the action in audit logs
    await client.query(
      `
      INSERT INTO audit_logs (
        type, name, created_by_id, current_work, timestamp
      ) VALUES ($1, $2, $3, $4, $5)
      `,
      [
        "Non-Inline Instrument Creation",
        "Batch Insert",
        req.user.id,
        `Created ${createdInstruments.length} non-inline instruments`,
        new Date(),
      ]
    );

    await client.query("COMMIT");
    res.status(201).json({
      message: "Non-inline instruments created successfully",
      data: createdInstruments,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating non-inline instruments:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });
    res.status(500).json({
      message: "Failed to create non-inline instruments",
      error: error.message,
    });
  } finally {
    client.release();
  }
});

// @desc    Assign multiple non-inline instruments to a user
// @route   PUT /api/non-inline-instruments/assign/batch
// @access  Private
router.put("/assign/batch", protect, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    const { instrumentIds, userId, taskId } = req.body;

    // Validate input
    if (
      !instrumentIds ||
      !Array.isArray(instrumentIds) ||
      instrumentIds.length === 0
    ) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: "Instrument IDs are required and must be an array" });
    }

    // Validate instrumentIds are integers
    const invalidIds = instrumentIds.filter(
      (id) => !Number.isInteger(id) || id <= 0
    );
    if (invalidIds.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `Invalid instrument IDs: ${invalidIds.join(
          ", "
        )}. All IDs must be positive integers.`,
      });
    }

    if (!userId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "User ID is required" });
    }

    if (!taskId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Task ID is required" });
    }

    // Validate userId and taskId are integers
    if (!Number.isInteger(userId) || userId <= 0) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: "User ID must be a positive integer" });
    }

    if (!Number.isInteger(taskId) || taskId <= 0) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: "Task ID must be a positive integer" });
    }

    // Validate req.user.id
    if (!req.user || !req.user.id) {
      await client.query("ROLLBACK");
      return res.status(401).json({
        message: "User authentication failed: No user ID found",
      });
    }

    // Verify that the user exists in the users table
    const { rows: userRows } = await client.query(
      "SELECT id FROM users WHERE id = $1",
      [req.user.id]
    );
    if (userRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `User ID ${req.user.id} does not exist in the users table`,
      });
    }

    // Ensure the user is either a team member under the Team Lead or the Team Lead themselves
    const { rows: teamMembers } = await client.query(
      `
      SELECT member_id 
      FROM team_members 
      WHERE lead_id = $1
      `,
      [req.user.id]
    );

    const teamMemberIds = teamMembers.map((member) =>
      member.member_id.toString()
    );
    const isTeamMember = teamMemberIds.includes(userId.toString());
    const isTeamLead = userId.toString() === req.user.id.toString();

    if (!isTeamMember && !isTeamLead) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "User is not a team member under your lead",
      });
    }

    // Verify that all instrument IDs exist
    const { rows: instruments } = await client.query(
      `
      SELECT id 
      FROM non_inline_instruments 
      WHERE id = ANY($1::int[])
      `,
      [instrumentIds]
    );

    const existingInstrumentIds = instruments.map(
      (instrument) => instrument.id
    );
    const invalidInstrumentIds = instrumentIds.filter(
      (id) => !existingInstrumentIds.includes(id)
    );

    if (invalidInstrumentIds.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `The following instrument IDs do not exist: ${invalidInstrumentIds.join(
          ", "
        )}`,
      });
    }

    // Verify that the task exists and is assigned to the user
    const { rows: taskRows } = await client.query(
      `
      SELECT id 
      FROM tasks 
      WHERE id = $1 AND assignee_id = $2
      `,
      [taskId, userId]
    );

    if (taskRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `Task ID ${taskId} not found or not assigned to user ID ${userId}`,
      });
    }

    // Update the non-inline instruments to assign them to the user
    await client.query(
      `
      UPDATE non_inline_instruments 
      SET assigned_to = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($2::int[])
      `,
      [userId, instrumentIds]
    );

    // Log the assignment in audit_logs
    const { rows: userRowsAssignment } = await client.query(
      `
      SELECT name 
      FROM users 
      WHERE id = $1
      `,
      [userId]
    );
    const assigneeName = userRowsAssignment[0]?.name || "Unknown";

    await client.query(
      `
      INSERT INTO audit_logs (type, name, created_by_id, current_work, timestamp)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        "Non-Inline Instrument Assignment",
        "Batch Non-Inline Instrument Assignment",
        req.user.id,
        `Assigned non-inline instruments ${instrumentIds.join(
          ", "
        )} to user ${assigneeName} (ID: ${userId}) for task ${taskId}`,
        new Date(),
      ]
    );

    await client.query("COMMIT");

    res.status(200).json({
      message: `Successfully assigned ${instrumentIds.length} non-inline instruments to user ${assigneeName} for task ${taskId}`,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error assigning non-inline instruments:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });

    // Handle more specific database errors
    if (error.code === "23503") {
      return res.status(400).json({
        message: "Foreign key violation in database",
        error: error.message,
      });
    }
    if (error.code === "23502") {
      return res.status(400).json({
        message: "Not-null constraint violation in database",
        error: error.message,
      });
    }
    if (error.code === "22P02") {
      return res.status(400).json({
        message: "Invalid data type in request (e.g., non-integer ID)",
        error: error.message,
      });
    }
    if (error.code === "42703") {
      return res.status(500).json({
        message: "Database schema error: undefined column",
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Failed to assign non-inline instruments",
      error: error.message,
    });
  } finally {
    client.release();
  }
});
module.exports = router;
