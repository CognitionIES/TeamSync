const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");
const { createTask } = require("../controllers/tasks.controller"); // Import createTask
// GET /api/tasks - Fetch tasks based on user role
router.get("/", protect, async (req, res) => {
  try {
    console.log("User role:", req.user.role);
    console.log("User ID:", req.user.id);

    const { project, team } = req.query; // Extract query parameters for filtering

    if (req.user.role === "Admin") {
      console.log("Fetching all tasks for Admin...");
      let query = `
        SELECT t.id, t.type, u.name as assignee, t.assignee_id, t.status, t.is_complex,
               t.created_at, t.updated_at, t.completed_at, t.progress, t.project_id,
               COALESCE((
                 SELECT json_agg(json_build_object(
                   'id', ti.id,
                   'name', ti.item_name,
                   'item_type', ti.item_type,
                   'completed', ti.completed
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
      `;
      const values = [];
      const conditions = [];

      // Apply project filter using project name
      if (project) {
        conditions.push(`p.name = $${values.length + 1}`);
        values.push(project);
      }

      // Apply team filter
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
                 u.name
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
                   'name', ti.item_name
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
      const query = `
        SELECT t.id, t.type, u.name as assignee, t.assignee_id, t.status, t.is_complex,
               t.created_at, t.updated_at, t.completed_at, t.progress, t.project_id,
               COALESCE((
                 SELECT json_agg(json_build_object(
                   'id', ti.id,
                   'name', ti.item_name,
                   'item_type', ti.item_type,
                   'completed', ti.completed
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
        WHERE t.assignee_id IN (
          SELECT member_id FROM team_members WHERE lead_id = $1
        )
        GROUP BY t.id, t.type, t.assignee_id, t.status, t.is_complex,
                 t.created_at, t.updated_at, t.completed_at, t.progress, t.project_id,
                 u.name
      `;
      const { rows } = await db.query(query, [req.user.id]);
      console.log("Tasks fetched for Team Lead:", rows);
      res.status(200).json({ data: rows });
    } else if (req.user.role === "Team Member") {
      console.log("Fetching tasks for Team Member ID:", req.user.id);
      const query = `
    SELECT t.id, t.type, u.name as assignee, t.assignee_id, t.status, t.is_complex,
           t.created_at, t.updated_at, t.completed_at, t.progress, t.project_id,
           t.description,  -- Added description field
           COALESCE((
             SELECT json_agg(json_build_object(
               'id', ti.id,
               'name', ti.item_name,
               'item_type', ti.item_type,
               'completed', ti.completed
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
    WHERE t.assignee_id = $1
    GROUP BY t.id, t.type, t.assignee_id, t.status, t.is_complex,
             t.created_at, t.updated_at, t.completed_at, t.progress, t.project_id,
             t.description, u.name  -- Added t.description to GROUP BY
  `;
      const { rows } = await db.query(query, [req.user.id]);
      console.log("Tasks fetched for Team Member:", rows);
      res.status(200).json({ data: rows });
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
router.post("/", protect, createTask); // Use the createTask function

// PATCH /api/tasks/:id/status - Update task status
router.patch("/:id/status", protect, async (req, res) => {
  try {
    if (req.user.role !== "Team Member") {
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
                 'item_name', ti.item_name,
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

// PATCH /api/tasks/:id/items/:itemId - Update task item status
router.patch("/:id/items/:itemId", protect, async (req, res) => {
  try {
    if (req.user.role !== "Team Member") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to update task items`,
      });
    }

    const taskId = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);
    const { completed } = req.body;

    if (typeof completed !== "boolean") {
      return res
        .status(400)
        .json({ message: "Completed status must be a boolean" });
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
    const projectName = task.project_name;

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
        completed = $1
      WHERE id = $2
      RETURNING *
      `,
      [completed, itemId]
    );

    const updatedItem = updatedItemRows[0];
    console.log("Updated task item:", updatedItem);

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
      SET 
        progress = $1,
        updated_at = CURRENT_TIMESTAMP
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
        "Task Item Update",
        task.type,
        req.user.id,
        `Updated task item ${updatedItem.item_name} (ID: ${itemId}) to completed=${completed} in project ${projectName}`,
        new Date(),
        projectName,
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
                 'item_name', ti.item_name,
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

module.exports = router;
