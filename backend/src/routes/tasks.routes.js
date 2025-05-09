const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// GET /api/tasks - Fetch tasks based on user role
router.get("/", protect, async (req, res) => {
  try {
    console.log("User role:", req.user.role);
    console.log("User ID:", req.user.id);

    if (req.user.role === "Project Manager") {
      console.log("Fetching all tasks for Project Manager...");
      const query = `
        SELECT t.id, t.type, u.name as assignee, t.assignee_id, t.status, t.is_complex,
               t.created_at, t.updated_at, t.completed_at, t.progress,
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
      `;
      const { rows } = await db.query(query, [req.user.id]); // Add the values array
      console.log("Tasks fetched for Project Manager:", rows);
      res.status(200).json({ data: rows });
    } else if (req.user.role === "Team Lead") {
      console.log("Fetching tasks for Team Lead ID:", req.user.id);
      const query = `
      SELECT t.id, t.type, u.name as assignee, t.assignee_id, t.status, t.is_complex,
             t.created_at, t.updated_at, t.completed_at, t.progress,
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
    `;
      const { rows } = await db.query(query, [req.user.id]);
      console.log("Tasks fetched for Team Lead:", rows);
      res.status(200).json({ data: rows });
    } else if (req.user.role === "Team Member") {
      console.log("Fetching tasks for Team Member ID:", req.user.id);
      const query = `
        SELECT t.id, t.type, u.name as assignee, t.assignee_id, t.status, t.is_complex,
               t.created_at, t.updated_at, t.completed_at, t.progress,
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
router.post("/", protect, async (req, res) => {
  try {
    if (req.user.role !== "Team Lead") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to create tasks`,
      });
    }

    const { type, assigneeId, isComplex, items } = req.body;
    console.log("Creating task with data:", {
      type,
      assigneeId,
      isComplex,
      items,
    });

    if (!type || !assigneeId) {
      return res
        .status(400)
        .json({ message: "Type and assigneeId are required" });
    }

    console.log("Validating assigneeId:", assigneeId);
    const { rows: userRows } = await db.query(
      `
      SELECT id FROM users WHERE id = $1
      `,
      [assigneeId]
    );
    if (userRows.length === 0) {
      return res
        .status(400)
        .json({ message: `Assignee with ID ${assigneeId} does not exist` });
    }

    console.log("Validating user id:", req.user.id);
    const { rows: userIdRows } = await db.query(
      `
      SELECT id FROM users WHERE id = $1
      `,
      [req.user.id]
    );
    if (userIdRows.length === 0) {
      return res
        .status(400)
        .json({ message: `User with ID ${req.user.id} does not exist` });
    }

    console.log("Checking for already assigned items...");
    const itemIds = items.map((item) => parseInt(item.itemId));
    const itemTypes = items.map((item) => item.itemType);

    // Check for duplicates within the same task type
    const { rows: existingItems } = await db.query(
      `
      SELECT ti.item_id, ti.item_type, ti.item_name, t.type as task_type
      FROM task_items ti
      JOIN tasks t ON ti.task_id = t.id
      WHERE (ti.item_id = ANY($1) AND ti.item_type = ANY($2)) AND t.type = $3
      `,
      [itemIds, itemTypes, type]
    );

    if (existingItems.length > 0) {
      console.log("Found already assigned items:", existingItems);
      const alreadyAssignedNames = existingItems
        .map((item) => item.item_name)
        .join(", ");
      return res.status(400).json({
        message: `Some items are already assigned to ${type} tasks: ${alreadyAssignedNames}`,
      });
    }

    console.log("Inserting into tasks table...");
    const { rows: taskRows } = await db.query(
      `
      INSERT INTO tasks (type, assignee_id, is_complex)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [type, assigneeId, isComplex]
    );

    const task = taskRows[0];
    console.log("Inserted task:", task);

    const uniqueItems = [];
    const seen = new Set();
    for (const item of items) {
      const key = `${item.itemId}-${item.itemType}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueItems.push(item);
      }
    }
    console.log("Deduplicated items:", uniqueItems);

    if (uniqueItems.length > 0) {
      console.log("Inserting into task_items table...");
      for (const item of uniqueItems) {
        console.log("Inserting task item:", item);
        try {
          await db.query(
            `
            INSERT INTO task_items (task_id, item_id, item_type, item_name)
            VALUES ($1, $2, $3, $4)
            `,
            [task.id, parseInt(item.itemId), item.itemType, item.itemName]
          );
        } catch (itemError) {
          console.error("Error inserting task item:", item, itemError.message);
          throw new Error(`Failed to insert task item: ${itemError.message}`);
        }
      }
      console.log("Inserted task items:", uniqueItems);
    }

    console.log("Fetching full task for response...");
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
      [task.id]
    );

    const createdTask = fullTaskRows[0];
    console.log("Full task response:", createdTask);
    res.status(201).json({
      data: {
        id: createdTask.id,
        type: createdTask.type,
        assignee: createdTask.assignee,
        assignee_id: createdTask.assignee_id,
        status: createdTask.status,
        is_complex: createdTask.is_complex,
        created_at: createdTask.created_at,
        updated_at: createdTask.updated_at,
        completed_at: createdTask.completed_at,
        progress: createdTask.progress,
        items: createdTask.items || [],
        comments: createdTask.comments || [],
      },
    });
  } catch (error) {
    console.error("Error creating task:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to create task", error: error.message });
  }
});

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

    if (task.status !== "In Progress") {
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
      return res.status(404).json({ message: "Task item not found" });
    }

    const item = itemRows[0];

    if (item.completed && !completed) {
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
    console.error("Error updating task item:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to update task item", error: error.message });
  }
});

// POST /api/tasks/:id/comments - Add a comment to a task
router.post("/:id/comments", protect, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { comment } = req.body;

    // Validate comment input
    if (
      !comment ||
      typeof comment !== "string" ||
      comment.trim().length === 0
    ) {
      return res.status(400).json({
        message: "Comment is required and must be a non-empty string",
      });
    }

    // Check if the task exists
    const { rows: taskRows } = await db.query(
      `
      SELECT * FROM tasks
      WHERE id = $1
      `,
      [taskId]
    );

    if (taskRows.length === 0) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Insert the comment into task_comments
    const { rows: commentRows } = await db.query(
      `
      INSERT INTO task_comments (task_id, user_id, user_name, user_role, comment)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [taskId, req.user.id, req.user.name, req.user.role, comment.trim()]
    );

    const newComment = commentRows[0];
    console.log("Added comment:", newComment);

    // Update the task's updated_at timestamp
    await db.query(
      `
      UPDATE tasks
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [taskId]
    );

    // Fetch the updated task with all details
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
    res.status(201).json({
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
    console.error("Error adding comment to task:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to add comment", error: error.message });
  }
});

module.exports = router;
