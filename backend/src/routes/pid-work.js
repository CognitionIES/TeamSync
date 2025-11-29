// routes/pid-work.js - Complete Fixed Version

const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

router.post("/mark-complete", protect, async (req, res) => {
  try {
    await db.query("BEGIN");

    const {
      pid_id,
      line_id,
      equipment_id,
      user_id,
      task_type,
      status,
      remarks,
      blocks = 0,
    } = req.body;

    console.log("📝 Mark complete request:", {
      pid_id, line_id, equipment_id, user_id, task_type, status, blocks
    });

    if (!["Pending", "In Progress", "Completed", "Skipped"].includes(status)) {
      await db.query("ROLLBACK");
      return res.status(400).json({ message: "Invalid status" });
    }

    if (!line_id && !equipment_id) {
      await db.query("ROLLBACK");
      return res.status(400).json({
        message: "Either line_id or equipment_id must be provided"
      });
    }

    // ✅ CRITICAL FIX: First, FIND the existing work item by its unique key
    const findQuery = `
      SELECT pwi.*, t.status as task_status
      FROM pid_work_items pwi
      JOIN tasks t ON pwi.task_id = t.id
      WHERE pwi.pid_id = $1
        AND pwi.user_id = $2
        AND pwi.task_type = $3
        AND (
          (pwi.line_id = $4 AND $4 IS NOT NULL) OR 
          (pwi.equipment_id = $5 AND $5 IS NOT NULL)
        )
      LIMIT 1
    `;

    const findResult = await db.query(findQuery, [
      pid_id,
      user_id,
      task_type,
      line_id || null,
      equipment_id || null
    ]);

    if (findResult.rows.length === 0) {
      await db.query("ROLLBACK");
      return res.status(404).json({
        message: "Work item not found. This item may not be assigned to you."
      });
    }

    const existingItem = findResult.rows[0];
    const taskId = existingItem.task_id;
    const taskStatus = existingItem.task_status;

    console.log(`✅ Found existing work item: ID=${existingItem.id}, task_id=${taskId}`);

    // ✅ Prevent changes if already completed
    if (existingItem.status === "Completed" && status !== "Completed") {
      await db.query("ROLLBACK");
      return res.status(400).json({
        message: "Cannot modify a completed item"
      });
    }

    // ✅ Auto-transition task to In Progress
    if (taskStatus === "Assigned" && (status === "In Progress" || status === "Completed")) {
      await db.query(
        `UPDATE tasks SET status = 'In Progress', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [taskId]
      );
      console.log(`✅ Task ${taskId} auto-transitioned to In Progress`);
    }

    const completed_at = status === "Completed" ? new Date() : null;

    // ✅ CRITICAL FIX: UPDATE by ID, not INSERT
    const updateQuery = `
      UPDATE pid_work_items
      SET 
        status = $1,
        completed_at = $2,
        remarks = $3,
        blocks = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *;
    `;

    const updateResult = await db.query(updateQuery, [
      status,
      completed_at,
      remarks || existingItem.remarks,
      blocks,
      existingItem.id  // ✅ Update by ID, not by composite key
    ]);

    const updatedItem = updateResult.rows[0];
    console.log(`✅ Updated work item: status=${updatedItem.status}, blocks=${updatedItem.blocks}`);

    // ✅ Update daily_metrics
    if (status === "Completed" && blocks > 0) {
      const date = new Date().toISOString().split("T")[0];
      let entityId = line_id;
      let itemType = "Line";

      if (!entityId && equipment_id) {
        itemType = "Equipment";
        const lineQuery = `SELECT id FROM lines WHERE pid_id = $1 ORDER BY id ASC LIMIT 1`;
        const lineResult = await db.query(lineQuery, [pid_id]);
        if (lineResult.rows.length > 0) {
          entityId = lineResult.rows[0].id;
        }
      }

      if (entityId) {
        await db.query(
          `INSERT INTO daily_metrics (
            user_id, entity_id, item_type, task_type, count, date, blocks
          ) VALUES ($1, $2, $3, $4, 1, $5, $6)
          ON CONFLICT (user_id, date, item_type, task_type, entity_id)
          DO UPDATE SET
            count = daily_metrics.count + 1,
            blocks = daily_metrics.blocks + $6,
            updated_at = CURRENT_TIMESTAMP`,
          [user_id, entityId, itemType, task_type, date, blocks]
        );
      }
    }

    // ✅ Calculate task progress
    const progressQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('Completed', 'Skipped') THEN 1 ELSE 0 END) as completed
      FROM pid_work_items
      WHERE task_id = $1
    `;

    const progressResult = await db.query(progressQuery, [taskId]);
    const { total, completed } = progressResult.rows[0];
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    await db.query(
      `UPDATE tasks SET progress = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [progress, taskId]
    );

    console.log(`📊 Task ${taskId} progress: ${completed}/${total} (${progress}%)`);

    // ✅ Auto-complete task when 100%
    if (progress === 100) {
      await db.query(
        `UPDATE tasks 
         SET status = 'Completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status != 'Completed'`,
        [taskId]
      );
      console.log(`✅ Task ${taskId} auto-completed`);
    }

    await db.query("COMMIT");

    res.status(200).json({
      message: "Work item updated successfully",
      data: {
        id: updatedItem.id,
        pid_id: updatedItem.pid_id,
        line_id: updatedItem.line_id,
        equipment_id: updatedItem.equipment_id,
        status: updatedItem.status,
        blocks: updatedItem.blocks,
        completed_at: updatedItem.completed_at,
        task_id: updatedItem.task_id,
        task_progress: progress
      },
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("❌ Error marking work item complete:", error);
    res.status(500).json({
      message: "Failed to update work item",
      error: error.message,
    });
  }
});

// Get user's assigned PIDs for a specific task type
router.get("/users/:user_id/assigned-pids", protect, async (req, res) => {
  try {
    const { user_id } = req.params;
    const { task_type = "UPV", date } = req.query;

    const query = `
      SELECT DISTINCT
        p.id as pid_id,
        p.pid_number,
        pwi.task_type,
        COUNT(*) as total_items,
        SUM(CASE WHEN pwi.status = 'Completed' THEN 1 ELSE 0 END) as completed_items,
        SUM(CASE WHEN pwi.status = 'Skipped' THEN 1 ELSE 0 END) as skipped_items,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', pwi.id,
            'line_id', pwi.line_id,
            'line_number', l.line_number,
            'equipment_id', pwi.equipment_id,
            'equipment_number', e.equipment_number,
            'status', pwi.status,
            'remarks', pwi.remarks,
            'blocks', pwi.blocks,
            'completed_at', pwi.completed_at
          ) ORDER BY l.line_number, e.equipment_number
        ) as items
      FROM pid_work_items pwi
      JOIN pids p ON pwi.pid_id = p.id
      LEFT JOIN lines l ON pwi.line_id = l.id
      LEFT JOIN equipment e ON pwi.equipment_id = e.id
      WHERE pwi.user_id = $1
        AND pwi.task_type = $2
        ${date ? "AND DATE(pwi.created_at) = $3" : ""}
      GROUP BY p.id, p.pid_number, pwi.task_type
      ORDER BY p.pid_number;
    `;

    const params = [user_id, task_type];
    if (date) params.push(date);

    const result = await db.query(query, params);

    res.status(200).json({
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching assigned PIDs:", error);
    res.status(500).json({
      message: "Failed to fetch assigned PIDs",
      error: error.message,
    });
  }
});

// Get daily UPV summary for Project Manager/Team Lead
router.get("/upv-summary/daily", protect, async (req, res) => {
  try {
    if (req.user.role !== "Project Manager" && req.user.role !== "Team Lead") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const { date } = req.query;
    const formattedDate = date || new Date().toISOString().split("T")[0];

    const query = `
      SELECT
        u.id as user_id,
        u.name as user_name,
        COUNT(DISTINCT pwi.pid_id) as pids_completed,
        COUNT(DISTINCT pwi.line_id) FILTER (WHERE pwi.line_id IS NOT NULL) as lines_completed,
        COUNT(DISTINCT pwi.equipment_id) FILTER (WHERE pwi.equipment_id IS NOT NULL) as equipment_completed,
        ARRAY_AGG(DISTINCT pwi.line_id) FILTER (WHERE pwi.line_id IS NOT NULL) as line_ids,
        ARRAY_AGG(DISTINCT pwi.equipment_id) FILTER (WHERE pwi.equipment_id IS NOT NULL) as equipment_ids,
        SUM(pwi.blocks) as total_blocks
      FROM pid_work_items pwi
      JOIN users u ON pwi.user_id = u.id
      WHERE pwi.task_type = 'UPV'
        AND pwi.status = 'Completed'
        AND DATE(pwi.completed_at) = $1
      GROUP BY u.id, u.name
      ORDER BY u.name;
    `;

    const result = await db.query(query, [formattedDate]);

    const summary = result.rows.map((row) => ({
      userId: row.user_id.toString(),
      userName: row.user_name,
      pidsCompleted: row.pids_completed,
      linesCompleted: row.lines_completed,
      equipmentCompleted: row.equipment_completed,
      lineIds: row.line_ids || [],
      equipmentIds: row.equipment_ids || [],
      totalBlocks: row.total_blocks || 0,
    }));

    res.status(200).json({
      date: formattedDate,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching UPV summary:", error);
    res.status(500).json({
      message: "Failed to fetch UPV summary",
      error: error.message,
    });
  }
});

router.post("/assign-pid", protect, async (req, res) => {
  try {
    if (req.user.role !== "Team Lead" && req.user.role !== "Project Manager") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const { pid_id, user_id, task_type, project_id } = req.body;

    console.log("🔵 PID Assignment Request:", {
      pid_id,
      user_id,
      task_type,
      project_id,
      body: req.body
    });

    // ✅ Validate inputs
    if (!pid_id || !user_id || !task_type || !project_id) {
      return res.status(400).json({
        message: "Missing required fields",
        received: { pid_id, user_id, task_type, project_id }
      });
    }

    // ✅ Parse IDs properly
    const pidIdInt = parseInt(pid_id);
    const userIdInt = parseInt(user_id);
    const projectIdInt = parseInt(project_id);

    if (isNaN(pidIdInt) || isNaN(userIdInt) || isNaN(projectIdInt)) {
      return res.status(400).json({
        message: "Invalid ID format",
        received: { pid_id, user_id, project_id }
      });
    }

    await db.query("BEGIN");

    try {
      // ✅ Check if PID already assigned
      const pidCheckQuery = `
        SELECT pwi.user_id, u.name as user_name, pwi.task_id
        FROM pid_work_items pwi
        JOIN users u ON pwi.user_id = u.id
        WHERE pwi.pid_id = $1 
          AND pwi.task_type = $2
        LIMIT 1
      `;

      const pidCheck = await db.query(pidCheckQuery, [pidIdInt, task_type]);

      if (pidCheck.rows.length > 0) {
        await db.query("ROLLBACK");
        const existingUser = pidCheck.rows[0];
        return res.status(400).json({
          message: `PID already assigned to ${existingUser.user_name}`,
          error: "PID_ALREADY_ASSIGNED"
        });
      }

      // ✅ Get PID info
      const pidInfoQuery = `SELECT pid_number, project_id FROM pids WHERE id = $1`;
      const pidInfo = await db.query(pidInfoQuery, [pidIdInt]);

      if (pidInfo.rows.length === 0) {
        await db.query("ROLLBACK");
        return res.status(404).json({ message: "PID not found" });
      }

      const pidNumber = pidInfo.rows[0].pid_number;
      const pidProjectId = pidInfo.rows[0].project_id;

      console.log(`✅ Found PID: ${pidNumber} (project: ${pidProjectId})`);

      // ✅ Find or create task (group assignments within 5 minutes)
      const recentTaskQuery = `
        SELECT id, created_at
        FROM tasks
        WHERE assignee_id = $1
          AND type = $2
          AND project_id = $3
          AND status = 'Assigned'
          AND is_pid_based = true
          AND created_at >= NOW() - INTERVAL '5 minutes'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      let taskId;
      const recentTaskResult = await db.query(recentTaskQuery, [
        userIdInt,
        task_type,
        projectIdInt
      ]);

      if (recentTaskResult.rows.length > 0) {
        taskId = recentTaskResult.rows[0].id;
        console.log(`♻️ Reusing task ${taskId} (created ${recentTaskResult.rows[0].created_at})`);
      } else {
        // Create new task
        const taskInsertQuery = `
          INSERT INTO tasks (
            type, assignee_id, status, is_complex, project_id, progress,
            is_pid_based, created_at, updated_at
          ) VALUES ($1, $2, 'Assigned', false, $3, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id, created_at
        `;

        const taskResult = await db.query(taskInsertQuery, [
          task_type,
          userIdInt,
          projectIdInt
        ]);

        taskId = taskResult.rows[0].id;
        console.log(`✨ Created new task ${taskId}`);
      }

      // ✅ Get all lines and equipment in this PID
      const itemsQuery = `
        SELECT 
          id as line_id, 
          NULL::integer as equipment_id, 
          'Line' as item_type,
          line_number as item_name
        FROM lines 
        WHERE pid_id = $1
        
        UNION ALL
        
        SELECT 
          NULL::integer as line_id, 
          id as equipment_id, 
          'Equipment' as item_type,
          equipment_number as item_name
        FROM equipment 
        WHERE pid_id = $1
        
        ORDER BY item_name
      `;

      const itemsResult = await db.query(itemsQuery, [pidIdInt]);
      const items = itemsResult.rows;

      console.log(`📋 Found ${items.length} items in PID ${pidNumber}`);

      if (items.length === 0) {
        await db.query("ROLLBACK");
        return res.status(400).json({
          message: `PID ${pidNumber} has no lines or equipment to assign`
        });
      }

      // ✅ Insert pid_work_items with task_id
      const insertItemsQuery = `
        INSERT INTO pid_work_items (
          pid_id, line_id, equipment_id, user_id, task_type, task_id, 
          status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'Pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (pid_id, line_id, equipment_id, user_id, task_type, task_id) 
        DO NOTHING
        RETURNING id
      `;

      let createdCount = 0;
      const createdItems = [];

      for (const item of items) {
        try {
          const result = await db.query(insertItemsQuery, [
            pidIdInt,
            item.line_id,
            item.equipment_id,
            userIdInt,
            task_type,
            taskId
          ]);

          if (result.rows.length > 0) {
            createdCount++;
            createdItems.push({
              id: result.rows[0].id,
              line_id: item.line_id,
              equipment_id: item.equipment_id,
              item_name: item.item_name
            });
          }
        } catch (itemError) {
          console.error(`❌ Error inserting item:`, itemError.message);
          // Continue with other items
        }
      }

      console.log(`✅ Created ${createdCount}/${items.length} work items for task ${taskId}`);

      if (createdCount === 0) {
        await db.query("ROLLBACK");
        return res.status(400).json({
          message: "Failed to create any work items. They may already exist.",
          error: "NO_ITEMS_CREATED"
        });
      }

      await db.query("COMMIT");

      res.status(201).json({
        message: `PID ${pidNumber} assigned successfully`,
        data: {
          taskId: taskId,
          pidId: pidIdInt,
          pidNumber: pidNumber,
          userId: userIdInt,
          taskType: task_type,
          itemsCount: createdCount,
          isNewTask: recentTaskResult.rows.length === 0,
          items: createdItems
        },
      });

    } catch (innerError) {
      await db.query("ROLLBACK");
      console.error("❌ Inner transaction error:", innerError);
      throw innerError;
    }

  } catch (error) {
    console.error("❌ Error assigning PID:", {
      message: error.message,
      detail: error.detail,
      hint: error.hint,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      code: error.code,
      stack: error.stack
    });

    res.status(500).json({
      message: "Failed to assign PID",
      error: error.message,
      detail: error.detail || "Check server logs for details",
      code: error.code
    });
  }
});
router.get("/hierarchy/:taskId", protect, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { task_type = "UPV" } = req.query;

    const query = `
      SELECT
        pwi.id, pwi.pid_id, p.pid_number,
        pwi.line_id, l.line_number,
        pwi.equipment_id, e.equipment_number,
        pwi.status, pwi.completed_at, pwi.remarks, pwi.blocks
      FROM pid_work_items pwi
      JOIN pids p ON pwi.pid_id = p.id
      LEFT JOIN lines l ON pwi.line_id = l.id
      LEFT JOIN equipment e ON pwi.equipment_id = e.id
      WHERE pwi.user_id IN (
        SELECT assignee_id FROM tasks WHERE id = $1
      )
      AND pwi.task_type = $2
      ORDER BY pwi.pid_id, l.line_number, e.equipment_number;
    `;

    const { rows } = await db.query(query, [taskId, task_type]);

    const groups = rows.reduce((acc, r) => {
      const key = r.pid_id;
      if (!acc[key]) {
        acc[key] = {
          pidId: r.pid_id,
          pidNumber: r.pid_number,
          items: [],
          completedCount: 0,
          totalCount: 0,
          allCompleted: true,
        };
      }
      const item = {
        id: r.id,
        lineId: r.line_id,
        lineNumber: r.line_number,
        equipmentId: r.equipment_id,
        equipmentNumber: r.equipment_number,
        status: r.status,
        completedAt: r.completed_at,
        remarks: r.remarks,
        blocks: r.blocks || 0,
      };
      acc[key].items.push(item);
      acc[key].totalCount++;
      if (!["Completed", "Skipped"].includes(r.status))
        acc[key].allCompleted = false;
      else acc[key].completedCount++;
      return acc;
    }, {});

    res.json({ data: Object.values(groups) });
  } catch (error) {
    console.error("Error fetching PID hierarchy:", error);
    res.status(500).json({
      message: "Failed to fetch PID hierarchy",
      error: error.message,
    });
  }
});

router.patch("/skip/:workItemId", protect, async (req, res) => {
  try {
    const { workItemId } = req.params;
    const { remarks = "Skipped – data missing" } = req.body;

    const query = `
      UPDATE pid_work_items
      SET status = 'Skipped', remarks = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const { rows } = await db.query(query, [remarks, workItemId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Work item not found" });
    }

    res.json({
      message: "Work item skipped successfully",
      data: rows[0]
    });
  } catch (error) {
    console.error("Error skipping work item:", error);
    res.status(500).json({
      message: "Failed to skip work item",
      error: error.message,
    });
  }
});

router.get("/summary", protect, async (req, res) => {
  try {
    if (req.user.role !== "Project Manager" && req.user.role !== "Team Lead") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const query = `
      SELECT
        u.id as user_id,
        u.name as user_name,
        p.pid_number,
        pwi.task_type,
        MIN(pwi.created_at) as assigned_date,
        CASE 
          WHEN COUNT(*) = SUM(CASE WHEN pwi.status IN ('Completed', 'Skipped') THEN 1 ELSE 0 END) 
          THEN 'Completed'
          WHEN SUM(CASE WHEN pwi.status = 'In Progress' THEN 1 ELSE 0 END) > 0
          THEN 'In Progress'
          ELSE 'Pending'
        END as status,
        COUNT(*) as total_items,
        SUM(CASE WHEN pwi.status = 'Completed' THEN 1 ELSE 0 END) as completed_items,
        SUM(CASE WHEN pwi.status = 'Skipped' THEN 1 ELSE 0 END) as skipped_items,
        SUM(COALESCE(pwi.blocks, 0)) as total_blocks,
        MAX(CASE WHEN pwi.status = 'Completed' THEN pwi.completed_at END) as completion_date
      FROM pid_work_items pwi
      JOIN users u ON pwi.user_id = u.id
      JOIN pids p ON pwi.pid_id = p.id
      GROUP BY u.id, u.name, p.pid_number, pwi.task_type, pwi.pid_id
      ORDER BY u.name, p.pid_number, pwi.task_type;
    `;

    const result = await db.query(query);

    res.status(200).json({
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching PID summary:", error);
    res.status(500).json({
      message: "Failed to fetch PID summary",
      error: error.message,
    });
  }
});

module.exports = router;