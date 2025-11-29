const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");
const {
  createTask,
  addTaskComment,
} = require("../controllers/tasks.controller");

// GET /api/tasks - Fetch tasks based on user role
router.get("/", protect, async (req, res) => {
  try {
    console.log("User role:", req.user.role);
    console.log("User ID:", req.user.id);

    const { project, team } = req.query;

    if (req.user.role === "Admin") {
      console.log("Fetching all tasks for Admin...");
      let query = `
    SELECT t.id, t.type, u.name as assignee, t.assignee_id, t.status, t.is_complex,
           t.created_at, t.updated_at, t.completed_at, t.progress, t.project_id,
           p.name as project_name,
           COALESCE(a.name, 'N/A') as area_name,
           COALESCE((
             SELECT json_agg(json_build_object(
               'id', ti.id,
               'name', ti.name,
               'item_type', ti.item_type,
               'completed', ti.completed,
               'blocks', COALESCE(ti.blocks, 0)
             ))
             FROM task_items ti
             WHERE t.id = ti.task_id
           ), '[]') as items,
           COALESCE((
             SELECT json_agg(json_build_object(
               'id', tc.id,
               'user_id', tc.user_id,
               'user_name', tc.user_name,
               'user_role', tc.user_role,
               'comment', tc.comment,
               'created_at', TO_CHAR(tc.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
             ))
             FROM task_comments tc
             WHERE t.id = tc.task_id
           ), '[]') as comments
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN areas a ON t.area_id = a.id
  `;
      const values = [];
      const conditions = [];

      if (project) {
        conditions.push(`p.name = $${values.length + 1}`);
        values.push(project);
      }

      if (team) {
        query += `
      JOIN team_members tm ON t.assignee_id = tm.member_id
    `;
        conditions.push(`tm.team_name = $${values.length + 1}`);
        values.push(team);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      query += `
    GROUP BY t.id, t.type, t.assignee_id, t.status, t.is_complex,
             t.created_at, t.updated_at, t.completed_at, t.progress, t.project_id,
             u.name, p.name, a.name
  `;

      const { rows } = await db.query(query, values);
      console.log("Tasks fetched for Admin:", rows);
      res.status(200).json({ data: rows });
    } else if (req.user.role === "Project Manager") {
      console.log("Fetching all tasks for Project Manager...");
      const query = `
        SELECT t.id, t.type, u.name as assignee, t.assignee_id, t.status, t.is_complex,
               t.created_at, t.updated_at, t.completed_at, t.progress, t.project_id,
               COALESCE((
                 SELECT json_agg(json_build_object(
                   'id', ti.id,
                   'name', ti.name
                 ))
                 FROM task_items ti
                 WHERE t.id = ti.task_id
               ), '[]') as items,
               COALESCE((
                 SELECT json_agg(json_build_object(
                   'id', tc.id,
                   'text', tc.comment
                 ))
                 FROM task_comments tc
                 WHERE t.id = tc.task_id
               ), '[]') as comments
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        WHERE t.assignee_id IN (
          SELECT member_id
          FROM team_members
          WHERE lead_id IN (
            SELECT member_id
            FROM team_members
            WHERE lead_id = $1
          )
        )
        GROUP BY t.id, t.type, t.assignee_id, t.status, t.is_complex,
                 t.created_at, t.updated_at, t.completed_at, t.progress, t.project_id,
                 u.name
      `;
      const { rows } = await db.query(query, [req.user.id]);
      console.log("Tasks fetched for Project Manager:", rows);
      res.status(200).json({ data: rows });
    } else if (req.user.role === "Team Lead") {
      console.log("Fetching tasks for Team Lead ID:", req.user.id);
      try {
        const query = `
        SELECT 
          t.id, 
          t.type, 
          u.name as assignee, 
          t.assignee_id, 
          t.status, 
          t.is_complex,
          t.created_at, 
          t.updated_at, 
          t.completed_at, 
          t.progress, 
          t.project_id,
          t.description,
          p.name as project_name,
          COALESCE(a.name, 'N/A') as area_name,
          COALESCE((
            SELECT pid.pid_number
            FROM task_items ti
            JOIN pids pid ON ti.item_id = pid.id AND ti.item_type = 'PID'
            WHERE ti.task_id = t.id
            LIMIT 1
          ), 'N/A') as pid_number,
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', ti.id,
              'name', ti.name,
              'item_type', ti.item_type,
              'completed', ti.completed,
              'completed_at', ti.completed_at,
              'blocks', COALESCE(ti.blocks, 0)
            ))
            FROM task_items ti
            WHERE t.id = ti.task_id AND ti.id IS NOT NULL
          ), '[]') as items,
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', tc.id,
              'user_id', tc.user_id,
              'user_name', tc.user_name,
              'user_role', tc.user_role,
              'comment', tc.comment,
              'created_at', TO_CHAR(tc.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            ))
            FROM task_comments tc
            WHERE t.id = tc.task_id AND tc.id IS NOT NULL AND tc.user_id IS NOT NULL
          ), '[]') as comments
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN areas a ON t.area_id = a.id
        WHERE t.assignee_id IN (
          SELECT member_id FROM team_members WHERE lead_id = $1
        ) OR t.assignee_id = $1
        GROUP BY 
          t.id, 
          t.type, 
          t.assignee_id, 
          t.status, 
          t.is_complex,
          t.created_at, 
          t.updated_at, 
          t.completed_at, 
          t.progress, 
          t.project_id,
          t.description,
          u.name,
          p.name,
          a.name
        `;
        const { rows } = await db.query(query, [req.user.id]);
        console.log("Tasks fetched for Team Lead:", rows);
        res.status(200).json({ data: rows });
      } catch (error) {
        console.error("Detailed error fetching tasks for Team Lead:", {
          message: error.message,
          stack: error.stack,
          queryError: error.code,
          queryDetail: error.detail,
          queryHint: error.hint,
        });
        res
          .status(500)
          .json({ message: "Failed to fetch tasks", error: error.message });
      }
    } else if (req.user.role === "Team Member") {
      console.log("Fetching tasks for Team Member ID:", req.user.id);
      try {
        const query = `
SELECT
  t.id,
  t.type,
  u.name as assignee,
  t.assignee_id,
  t.status,
  t.is_complex,
  t.created_at,
  t.updated_at,
  t.completed_at,
  t.progress,
  t.project_id,
  t.description,
  t.is_pid_based,
  p.name as project_name,
  COALESCE(a.name, 'N/A') as area_name,
  
  -- Get first PID number for display
  COALESCE((
    SELECT pids.pid_number
    FROM pid_work_items pwi
    JOIN pids ON pwi.pid_id = pids.id
    WHERE pwi.task_id = t.id
    ORDER BY pwi.created_at ASC
    LIMIT 1
  ), COALESCE((
    SELECT pid.pid_number
    FROM task_items ti
    JOIN pids pid ON ti.item_id = pid.id AND ti.item_type = 'PID'
    WHERE ti.task_id = t.id
    LIMIT 1
  ), 'N/A')) as pid_number,
 
  -- ✅ CRITICAL FIX: Only get work items for THIS task
  CASE 
    WHEN t.is_pid_based = true 
    THEN COALESCE((
      SELECT json_agg(json_build_object(
        'id', pwi.id,
        'pid_id', pwi.pid_id,
        'pid_number', pids.pid_number,
        'line_id', pwi.line_id,
        'line_number', l.line_number,
        'equipment_id', pwi.equipment_id,
        'equipment_number', e.equipment_number,
        'status', pwi.status,
        'completed_at', pwi.completed_at,
        'remarks', pwi.remarks,
        'blocks', COALESCE(pwi.blocks, 0)
      ) ORDER BY pids.pid_number, l.line_number, e.equipment_number)
      FROM pid_work_items pwi
      LEFT JOIN pids ON pwi.pid_id = pids.id
      LEFT JOIN lines l ON pwi.line_id = l.id
      LEFT JOIN equipment e ON pwi.equipment_id = e.id
      WHERE pwi.task_id = t.id
    ), '[]')
    ELSE '[]'
  END as pid_work_items,
 
  -- Regular task items (for non-PID tasks)
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', ti.id,
      'name', ti.name,
      'item_type', ti.item_type,
      'completed', ti.completed,
      'completed_at', ti.completed_at,
      'blocks', COALESCE(ti.blocks, 0)
    ))
    FROM task_items ti
    WHERE t.id = ti.task_id AND ti.id IS NOT NULL
  ), '[]') as items,
 
  -- Comments
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', tc.id,
      'user_id', tc.user_id,
      'user_name', tc.user_name,
      'user_role', tc.user_role,
      'comment', tc.comment,
      'created_at', TO_CHAR(tc.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ))
    FROM task_comments tc
    WHERE t.id = tc.task_id AND tc.id IS NOT NULL AND tc.user_id IS NOT NULL
  ), '[]') as comments
  
FROM tasks t
LEFT JOIN users u ON t.assignee_id = u.id
LEFT JOIN projects p ON t.project_id = p.id
LEFT JOIN areas a ON t.area_id = a.id
WHERE t.assignee_id = $1
ORDER BY 
  CASE t.status 
    WHEN 'Assigned' THEN 1 
    WHEN 'In Progress' THEN 2 
    WHEN 'Completed' THEN 3 
  END,
  t.created_at DESC
    `;


        const { rows } = await db.query(query, [req.user.id]);
        console.log("Tasks fetched for Team Member:", rows);
        res.status(200).json({ data: rows });
      } catch (error) {
        console.error("Detailed error fetching tasks for Team Member:", {
          message: error.message,
          stack: error.stack,
          queryError: error.code,
          queryDetail: error.detail,
          queryHint: error.hint,
        });
        res
          .status(500)
          .json({ message: "Failed to fetch tasks", error: error.message });
      }
    } else {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to view tasks`,
      });
    }
  } catch (error) {
    console.error("Error fetching tasks:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to fetch tasks", error: error.message });
  }
});

// POST /api/tasks - Create a new task
router.post("/", protect, createTask);

// PATCH /api/tasks/:id/status - Update task status
// PATCH /api/tasks/:id/status - Update task status
router.patch("/:id/status", protect, async (req, res) => {
  try {
    // Allow both Team Member and Team Lead
    if (req.user.role !== "Team Member" && req.user.role !== "Team Lead") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to update task status`,
      });
    }

    const taskId = parseInt(req.params.id);
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const validStatuses = ["Assigned", "In Progress", "Completed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status: ${status}` });
    }

    const { rows: taskRows } = await db.query(
      `
      SELECT * FROM tasks
      WHERE id = $1 AND assignee_id = $2
      `,
      [taskId, req.user.id]
    );

    if (taskRows.length === 0) {
      return res
        .status(404)
        .json({ message: "Task not found or not assigned to you" });
    }

    const task = taskRows[0];

    if (task.status === "Completed") {
      return res.status(400).json({ message: "Task is already completed" });
    }

    if (task.status === "Assigned" && status !== "In Progress") {
      return res
        .status(400)
        .json({ message: "Task must be started before it can be completed" });
    }

    if (task.status === "In Progress" && status === "Assigned") {
      return res
        .status(400)
        .json({ message: "Cannot revert task to Assigned status" });
    }

    const completedAtUpdate =
      status === "Completed" ? "completed_at = CURRENT_TIMESTAMP," : "";
    const { rows: updatedTaskRows } = await db.query(
      `
      UPDATE tasks
      SET 
        status = $1,
        ${completedAtUpdate}
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
      `,
      [status, taskId]
    );

    const updatedTask = updatedTaskRows[0];
    console.log("Updated task status:", updatedTask);

    const { rows: fullTaskRows } = await db.query(
      `
      SELECT t.*, u.name as assignee,
             json_agg(
               json_build_object(
                 'id', ti.id,
                 'item_name', ti.name,
                 'item_type', ti.item_type,
                 'completed', ti.completed
               )
             ) FILTER (WHERE ti.id IS NOT NULL) as items,
             json_agg(
               json_build_object(
                 'id', tc.id,
                 'user_id', tc.user_id,
                 'user_name', tc.user_name,
                 'user_role', tc.user_role,
                 'comment', tc.comment,
                 'created_at', TO_CHAR(tc.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
               )
             ) FILTER (WHERE tc.id IS NOT NULL) as comments
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN task_items ti ON t.id = ti.task_id
      LEFT JOIN task_comments tc ON t.id = tc.task_id
      WHERE t.id = $1
      GROUP BY t.id, u.name
      `,
      [taskId]
    );

    const returnedTask = fullTaskRows[0];
    res.status(200).json({
      data: {
        id: returnedTask.id,
        type: returnedTask.type,
        assignee: returnedTask.assignee,
        assignee_id: returnedTask.assignee_id,
        status: returnedTask.status,
        is_complex: returnedTask.is_complex,
        created_at: returnedTask.created_at,
        updated_at: returnedTask.updated_at,
        completed_at: returnedTask.completed_at,
        progress: returnedTask.progress,
        items: returnedTask.items || [],
        comments: returnedTask.comments || [],
      },
    });
  } catch (error) {
    console.error("Error updating task status:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to update task status", error: error.message });
  }
});

// PATCH /api/tasks/:id/items/:itemId
router.patch("/:id/items/:itemId", protect, async (req, res) => {
  try {
    // Allow both Team Member AND Team Lead
    if (req.user.role !== "Team Member" && req.user.role !== "Team Lead") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to update task items`,
      });
    }

    const taskId = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);
    const { completed, blocks } = req.body;

    console.log("Received payload:", { completed, blocks });

    if (typeof completed !== "boolean") {
      return res
        .status(400)
        .json({ message: "Completed status must be a boolean" });
    }
    if (typeof blocks !== "number" || blocks < 0) {
      return res
        .status(400)
        .json({ message: "Blocks must be a non-negative number" });
    }

    await db.query("BEGIN");

    const { rows: taskRows } = await db.query(
      `
      SELECT t.*, p.name as project_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.id = $1 AND t.assignee_id = $2
      `,
      [taskId, req.user.id]
    );

    if (taskRows.length === 0) {
      await db.query("ROLLBACK");
      return res
        .status(404)
        .json({ message: "Task not found or not assigned to you" });
    }

    const task = taskRows[0];
    if (task.status !== "In Progress") {
      await db.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: "Task must be in progress to update items" });
    }

    const { rows: itemRows } = await db.query(
      `
      SELECT * FROM task_items
      WHERE id = $1 AND task_id = $2
      `,
      [itemId, taskId]
    );

    if (itemRows.length === 0) {
      await db.query("ROLLBACK");
      return res.status(404).json({ message: "Task item not found" });
    }

    const item = itemRows[0];
    if (item.completed && !completed) {
      await db.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: "Cannot uncheck a completed item" });
    }

    const { rows: updatedItemRows } = await db.query(
      `
      UPDATE task_items
      SET 
        completed = $1,
        completed_at = CASE WHEN $1 = true THEN CURRENT_TIMESTAMP ELSE NULL END,
        blocks = $2
      WHERE id = $3
      RETURNING *
      `,
      [completed, blocks, itemId]
    );

    const updatedItem = updatedItemRows[0];

    // Mark item as UPV-completed when a UPV task item is completed
    if (completed && task.type === "UPV") {
      if (item.item_type === "Line") {
        await db.query(
          `UPDATE lines SET upv_completed = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [item.item_id]
        );
        console.log(`Marked line ${item.item_id} as UPV completed`);
      } else if (item.item_type === "Equipment") {
        await db.query(
          `UPDATE equipment SET upv_completed = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [item.item_id]
        );
        console.log(`Marked equipment ${item.item_id} as UPV completed`);
      } else if (item.item_type === "NonInlineInstrument") {
        await db.query(
          `UPDATE non_inline_instruments SET upv_completed = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [item.item_id]
        );
        console.log(
          `Marked non-inline instrument ${item.item_id} as UPV completed`
        );
      }
    }

    // Dynamically map entity_id based on item_type (existing logic continues...)
    let entityId = item.line_id;
    if (!entityId) {
      if (item.item_type === "Line") {
        const lineResult = await db.query(
          `SELECT id FROM lines WHERE id = $1`,
          [item.item_id]
        );
        entityId = lineResult.rows.length > 0 ? lineResult.rows[0].id : null;
      } else if (item.item_type === "Equipment") {
        const equipResult = await db.query(
          `SELECT project_id FROM equipment WHERE id = $1`,
          [item.item_id]
        );
        if (equipResult.rows.length > 0) {
          const projectId = equipResult.rows[0].project_id;
          const lineMatch = await db.query(
            `SELECT id FROM lines WHERE project_id = $1 LIMIT 1`,
            [projectId]
          );
          entityId = lineMatch.rows.length > 0 ? lineMatch.rows[0].id : null;
        }
      } else if (item.item_type === "PID") {
        const pidResult = await db.query(`SELECT id FROM pids WHERE id = $1`, [
          item.item_id,
        ]);
        if (pidResult.rows.length > 0) {
          const pidId = pidResult.rows[0].id;
          const lineMatch = await db.query(
            `SELECT l.id FROM lines l JOIN pids p ON l.pid_id = p.id WHERE p.id = $1`,
            [pidId]
          );
          entityId = lineMatch.rows.length > 0 ? lineMatch.rows[0].id : null;
        }
      } else if (item.item_type === "NonInlineInstrument") {
        const instrResult = await db.query(
          `SELECT project_id FROM non_inline_instruments WHERE id = $1`,
          [item.item_id]
        );
        if (instrResult.rows.length > 0) {
          const projectId = instrResult.rows[0].project_id;
          const lineMatch = await db.query(
            `SELECT id FROM lines WHERE project_id = $1 LIMIT 1`,
            [projectId]
          );
          entityId = lineMatch.rows.length > 0 ? lineMatch.rows[0].id : null;
        }
      }
    }

    if (entityId === null) {
      await db.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: "Invalid entity ID for daily_metrics" });
    }

    // Update daily_metrics
    const date = new Date().toISOString().split("T")[0];
    const category = item.item_type || "Unknown";
    const countValue = completed ? 1 : -1;
    const blocksValue = completed ? blocks : -blocks;

    await db.query(
      `
      INSERT INTO daily_metrics (user_id, entity_id, item_type, task_type, count, date, blocks)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, date, item_type, task_type) 
      DO UPDATE SET 
        count = GREATEST(daily_metrics.count + $5, 0),
        blocks = GREATEST(daily_metrics.blocks + $7, 0),
        entity_id = $2,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        req.user.id,
        entityId,
        category,
        task.type || "UPV",
        countValue,
        date,
        blocksValue,
      ]
    );

    // Rest of the existing logic (progress update, audit logs, etc.) remains the same
    const { rows: allItems } = await db.query(
      `
      SELECT COUNT(*) as total, SUM(CASE WHEN completed = true THEN 1 ELSE 0 END) as completed_count
      FROM task_items
      WHERE task_id = $1
      `,
      [taskId]
    );

    const { total, completed_count } = allItems[0];
    const progress =
      total > 0 ? Math.round((completed_count / total) * 100) : 0;

    await db.query(
      `
      UPDATE tasks
      SET progress = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [progress, taskId]
    );

    const teamNameQuery = await db.query(
      `SELECT name FROM users WHERE id = $1`,
      [req.user.id]
    );
    const teamName = teamNameQuery.rows[0]?.name || "Unknown";

    await db.query(
      `
      INSERT INTO audit_logs (type, name, created_by_id, current_work, timestamp, project_name, team_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        "Task Item Toggle",
        task.type,
        req.user.id,
        `Toggled task item ${updatedItem.name} (ID: ${itemId}) to completed=${completed} with ${blocks} blocks in project ${task.project_name}`,
        new Date(),
        task.project_name,
        teamName,
      ]
    );

    await db.query("COMMIT");

    const { rows: fullTaskRows } = await db.query(
      `
      SELECT t.*, u.name as assignee,
             json_agg(
               json_build_object(
                 'id', ti.id,
                 'name', ti.name,
                 'item_type', ti.item_type,
                 'completed', ti.completed,
                 'blocks', ti.blocks
               )
             ) FILTER (WHERE ti.id IS NOT NULL) as items,
             json_agg(
               json_build_object(
                 'id', tc.id,
                 'user_id', tc.user_id,
                 'user_name', tc.user_name,
                 'user_role', tc.user_role,
                 'comment', tc.comment,
                 'created_at', TO_CHAR(tc.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
               )
             ) FILTER (WHERE tc.id IS NOT NULL) as comments
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN task_items ti ON t.id = ti.task_id
      LEFT JOIN task_comments tc ON t.id = tc.task_id
      WHERE t.id = $1
      GROUP BY t.id, u.name
      `,
      [taskId]
    );

    const returnedTask = fullTaskRows[0];
    res.status(200).json({
      data: {
        id: returnedTask.id,
        type: returnedTask.type,
        assignee: returnedTask.assignee,
        assignee_id: returnedTask.assignee_id,
        status: returnedTask.status,
        is_complex: returnedTask.is_complex,
        created_at: returnedTask.created_at,
        updated_at: returnedTask.updated_at,
        completed_at: returnedTask.completed_at,
        progress: returnedTask.progress,
        project_id: returnedTask.project_id,
        items: returnedTask.items || [],
        comments: returnedTask.comments || [],
      },
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Error updating task item:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to update task item", error: error.message });
  }
});
router.post("/:taskId/comments", protect, addTaskComment);

router.get("/blocks-summary", protect, async (req, res) => {
  try {
    if (req.user.role !== "Project Manager") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to view blocks summary`,
      });
    }

    console.log("Fetching blocks summary for Project Manager ID:", req.user.id);

    const query = `
      SELECT COALESCE(SUM(ti.blocks), 0) as total_blocks
      FROM tasks t
      JOIN task_items ti ON t.id = ti.task_id
      JOIN team_members tm1 ON t.assignee_id = tm1.member_id
      JOIN team_members tm2 ON tm1.lead_id = tm2.member_id
      WHERE tm2.lead_id = $1
      AND ti.completed = true
      AND t.status = 'Completed'
    `;
    const { rows } = await db.query(query, [req.user.id]);
    console.log("Blocks summary query result:", rows[0]);
    res.status(200).json({ data: { totalBlocks: rows[0].total_blocks } });
  } catch (error) {
    console.error("Error fetching blocks summary:", {
      message: error.message,
      stack: error.stack,
      query: error.query || "Not available",
      params: [req.user.id],
    });
    res.status(500).json({
      message: "Failed to fetch blocks summary",
      error: error.message,
    });
  }
});
router.get("/:itemId/entity", protect, async (req, res) => {
  try {
    const { itemId } = req.params;
    const itemIdNum = parseInt(itemId, 10);

    if (isNaN(itemIdNum)) {
      return res.status(400).json({ message: "Invalid item ID" });
    }

    const itemResult = await db.query(
      `
      SELECT item_type, item_id, line_id, task_id FROM task_items WHERE id = $1
      `,
      [itemIdNum]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ message: "Task item not found" });
    }

    const { item_type, item_id, line_id, task_id } = itemResult.rows[0];
    let entityId = line_id; // Use line_id if available
    if (!entityId) {
      if (item_type === "Line") {
        const lineResult = await db.query(
          `SELECT id FROM lines WHERE id = $1`,
          [item_id]
        );
        entityId = lineResult.rows.length > 0 ? lineResult.rows[0].id : null;
      } else if (item_type === "Equipment") {
        const equipResult = await db.query(
          `SELECT project_id FROM equipment WHERE id = $1`,
          [item_id]
        );
        if (equipResult.rows.length > 0) {
          const projectId = equipResult.rows[0].project_id;
          const lineMatch = await db.query(
            `SELECT id FROM lines WHERE project_id = $1 AND id IS NOT NULL LIMIT 1`,
            [projectId]
          );
          entityId = lineMatch.rows.length > 0 ? lineMatch.rows[0].id : null;
          if (entityId) {
            await db.query("UPDATE task_items SET line_id = $1 WHERE id = $2", [
              entityId,
              itemIdNum,
            ]);
          }
        }
      } else if (item_type === "PID") {
        const pidResult = await db.query(`SELECT id FROM pids WHERE id = $1`, [
          item_id,
        ]);
        if (pidResult.rows.length > 0) {
          const pidId = pidResult.rows[0].id;
          const lineMatch = await db.query(
            `SELECT l.id FROM lines l JOIN pids p ON l.pid_id = p.id WHERE p.id = $1`,
            [pidId]
          );
          entityId = lineMatch.rows.length > 0 ? lineMatch.rows[0].id : null;
          if (entityId) {
            await db.query("UPDATE task_items SET line_id = $1 WHERE id = $2", [
              entityId,
              itemIdNum,
            ]);
          }
        }
      } else if (item_type === "NonInlineInstrument") {
        const instrResult = await db.query(
          `SELECT project_id FROM non_inline_instruments WHERE id = $1`,
          [item_id]
        );
        if (instrResult.rows.length > 0) {
          const projectId = instrResult.rows[0].project_id;
          const lineMatch = await db.query(
            `SELECT id FROM lines WHERE project_id = $1 LIMIT 1`,
            [projectId]
          );
          entityId = lineMatch.rows.length > 0 ? lineMatch.rows[0].id : null;
          if (entityId) {
            await db.query("UPDATE task_items SET line_id = $1 WHERE id = $2", [
              entityId,
              itemIdNum,
            ]);
          }
        }
      }
    }

    if (entityId === null) {
      const taskProject = await db.query(
        `SELECT project_id FROM tasks WHERE id = $1`,
        [task_id]
      );
      if (taskProject.rows.length > 0) {
        const projectId = taskProject.rows[0].project_id;
        const lineMatch = await db.query(
          `SELECT id FROM lines WHERE project_id = $1 LIMIT 1`,
          [projectId]
        );
        entityId = lineMatch.rows.length > 0 ? lineMatch.rows[0].id : null;
        if (entityId) {
          await db.query("UPDATE task_items SET line_id = $1 WHERE id = $2", [
            entityId,
            itemIdNum,
          ]);
        }
      }
    }

    if (entityId === null) {
      return res
        .status(404)
        .json({ message: "No valid entity found for task item" });
    }

    res.status(200).json({ entityId });
  } catch (error) {
    console.error("Error fetching entity ID:", {
      message: error.message,
      stack: error.stack,
      itemId: req.params.itemId,
    });
    res
      .status(500)
      .json({ message: "Failed to fetch entity ID", error: error.message });
  }
});
// PATCH /api/tasks/:id/retract - Retract a task and optionally reassign
router.patch("/:id/retract", protect, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { newAssigneeId } = req.body; // Optional: new assignee ID for reassignment

    // Validate user role (only Team Lead can retract tasks)
    if (req.user.role !== "Team Lead") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to retract tasks`,
      });
    }

    // Check if the task exists and is assigned to the team lead's team
    const { rows: taskRows } = await db.query(
      `
      SELECT t.*, u.name as assignee, p.name as project_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.id = $1 AND (t.assignee_id IN (
        SELECT member_id FROM team_members WHERE lead_id = $2
      ) OR t.assignee_id = $2)
      `,
      [taskId, req.user.id]
    );

    if (taskRows.length === 0) {
      return res
        .status(404)
        .json({ message: "Task not found or not authorized" });
    }

    const task = taskRows[0];

    // Get completed items that should not be reassigned
    const { rows: completedItems } = await db.query(
      `
      SELECT id, item_type, item_id, name, completed FROM task_items
      WHERE task_id = $1 AND completed = true
      `,
      [taskId]
    );

    await db.query("BEGIN");

    try {
      // If reassigning to a new user
      if (newAssigneeId && parseInt(newAssigneeId) !== task.assignee_id) {
        const newAssigneeIdInt = parseInt(newAssigneeId);

        // Validate new assignee exists and is in the team
        const { rows: newAssigneeRows } = await db.query(
          `
          SELECT u.*, tm.lead_id
          FROM users u
          LEFT JOIN team_members tm ON u.id = tm.member_id
          WHERE u.id = $1 AND (tm.lead_id = $2 OR u.id = $2)
          `,
          [newAssigneeIdInt, req.user.id]
        );

        if (newAssigneeRows.length === 0) {
          await db.query("ROLLBACK");
          return res.status(400).json({
            message: "Invalid assignee or assignee not in your team",
          });
        }

        // Create a new task for the new assignee with only incomplete items
        const { rows: newTaskRows } = await db.query(
          `
          INSERT INTO tasks (type, assignee_id, status, is_complex, project_id, description, progress)
          VALUES ($1, $2, 'Assigned', $3, $4, $5, 0)
          RETURNING *
          `,
          [
            task.type,
            newAssigneeIdInt,
            task.is_complex,
            task.project_id,
            task.description,
          ]
        );

        const newTask = newTaskRows[0];

        // Copy only incomplete items to the new task
        const { rows: incompleteItems } = await db.query(
          `
          SELECT item_type, item_id, name, line_id
          FROM task_items
          WHERE task_id = $1 AND completed = false
          `,
          [taskId]
        );

        // Insert incomplete items into the new task
        // In tasks.routes.js, retraction endpoint (already correct):
        for (const item of incompleteItems) {
          if (item.item_type === "Line") {
            await db.query(
              `UPDATE lines SET assigned_to_id = NULL WHERE id = $1`,
              [item.item_id]
            );
          } else if (item.item_type === "Equipment") {
            await db.query(
              `UPDATE equipment SET assigned_to = NULL WHERE id = $1`,
              [item.item_id]
            );
          } else if (item.item_type === "NonInlineInstrument") {
            await db.query(
              `UPDATE non_inline_instruments SET assigned_to = NULL WHERE id = $1`,
              [item.item_id]
            );
          }
        }

        // Update the original task to mark it as completed (since completed items stay with original assignee)
        if (completedItems.length > 0) {
          // If there are completed items, keep the original task but remove incomplete items
          await db.query(
            `
            DELETE FROM task_items
            WHERE task_id = $1 AND completed = false
            `,
            [taskId]
          );

          // Update original task progress to 100% since only completed items remain
          await db.query(
            `
            UPDATE tasks
            SET status = 'Completed', progress = 100, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            `,
            [taskId]
          );
        } else {
          // If no completed items, we can delete the original task entirely
          await db.query(`DELETE FROM task_items WHERE task_id = $1`, [taskId]);
          await db.query(`DELETE FROM tasks WHERE id = $1`, [taskId]);
        }

        await db.query("COMMIT");

        // Get the new assignee name for response
        const newAssigneeName = newAssigneeRows[0].name;

        return res.status(200).json({
          message: `Task ${taskId} retracted and reassigned successfully`,
          data: {
            originalTask:
              completedItems.length > 0
                ? {
                  id: task.id,
                  status: "Completed",
                  assignee: task.assignee,
                  completedItems: completedItems.length,
                }
                : null,
            newTask: {
              id: newTask.id,
              type: newTask.type,
              assignee: newAssigneeName,
              assignee_id: newTask.assignee_id,
              status: newTask.status,
              incompleteItems: incompleteItems.length,
              progress: 0,
            },
          },
        });
      } else {
        // Just retracting without reassigning - reset the task
        await db.query(
          `
          UPDATE task_items
          SET completed = false, completed_at = NULL, blocks = 0
          WHERE task_id = $1 AND completed = false
          `,
          [taskId]
        );

        // Calculate new progress based on completed items only
        const { rows: progressData } = await db.query(
          `
          SELECT COUNT(*) as total, SUM(CASE WHEN completed = true THEN 1 ELSE 0 END) as completed_count
          FROM task_items
          WHERE task_id = $1
          `,
          [taskId]
        );

        const { total, completed_count } = progressData[0];
        const progress =
          total > 0 ? Math.round((completed_count / total) * 100) : 0;
        const newStatus = progress === 100 ? "Completed" : "Assigned";

        await db.query(
          `
          UPDATE tasks
          SET status = $1, progress = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
          `,
          [newStatus, progress, taskId]
        );

        await db.query("COMMIT");

        return res.status(200).json({
          message: `Task ${taskId} retracted successfully`,
          data: {
            id: task.id,
            status: newStatus,
            progress: progress,
            assignee: task.assignee,
          },
        });
      }
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Error retracting task:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to retract task", error: error.message });
  }
});

module.exports = router;
