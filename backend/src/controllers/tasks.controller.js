const db = require("../config/db");

// @desc    Get all tasks for a user or all tasks
// @route   GET /api/tasks
// @route   GET /api/tasks/user/:userId
const getTasks = async (req, res) => {
  try {
    let query, params;
    const { role, id: userId } = req.user;

    if (req.params.userId) {
      if (role === "Team Member" && req.params.userId != userId) {
        return res
          .status(403)
          .json({ message: "Not authorized to view tasks for other users" });
      }
      query = `
  SELECT t.id, t.type, t.assignee_id, t.status, t.is_complex, t.progress, 
         t.created_at, t.updated_at, t.completed_at, t.items, t.project_id, 
         t.description, u.name as assignee, p.name as project_name, 
         p2.pid_number, a.area_number
  FROM tasks t 
  JOIN users u ON t.assignee_id = u.id 
  LEFT JOIN projects p ON t.project_id = p.id
  LEFT JOIN pids p2 ON p2.id = (
    SELECT item_id FROM task_items WHERE task_id = t.id AND item_type = 'PID' LIMIT 1
  )
  LEFT JOIN areas a ON p2.area_id = a.id`;
      params = [req.params.userId];
    } else if (role === "Team Lead") {
      query = `
        SELECT t.*, u.name as assignee, p.name as project_name, p2.pid_number, a.area_number
        FROM tasks t 
        JOIN users u ON t.assignee_id = u.id 
        JOIN team_members tm ON t.assignee_id = tm.member_id 
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN pids p2 ON p2.id = (
          SELECT item_id FROM task_items WHERE task_id = t.id AND item_type = 'PID' LIMIT 1
        )
        LEFT JOIN areas a ON p2.area_id = a.id
        WHERE tm.lead_id = $1`;
      params = [userId];
    } else if (role === "Project Manager" || role === "Admin") {
      query = `
        SELECT t.*, u.name as assignee, p.name as project_name, p2.pid_number, a.area_number
        FROM tasks t 
        JOIN users u ON t.assignee_id = u.id
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN pids p2 ON p2.id = (
          SELECT item_id FROM task_items WHERE task_id = t.id AND item_type = 'PID' LIMIT 1
        )
        LEFT JOIN areas a ON p2.area_id = a.id`;
      params = [];
    } else {
      query = `
        SELECT t.*, u.name as assignee, p.name as project_name, p2.pid_number, a.area_number
        FROM tasks t 
        JOIN users u ON t.assignee_id = u.id 
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN pids p2 ON p2.id = (
          SELECT item_id FROM task_items WHERE task_id = t.id AND item_type = 'PID' LIMIT 1
        )
        LEFT JOIN areas a ON p2.area_id = a.id
        WHERE t.assignee_id = $1`;
      params = [userId];
    }

    const { rows: tasks } = await db.query(query, params);
    console.log("Raw tasks data from database:", tasks);

    // Fetch task items, comments, and lines for each task
    const tasksWithDetails = await Promise.all(
      tasks.map(async (task) => {
        const { rows: items } = await db.query(
          "SELECT * FROM task_items WHERE task_id = $1",
          [task.id]
        );

        const { rows: comments } = await db.query(
          "SELECT * FROM task_comments WHERE task_id = $1 ORDER BY created_at DESC",
          [task.id]
        );

        let lines = [];
        if (task.type === "Redline") {
          const { rows: taskLines } = await db.query(
            `
            SELECT tl.*, l.line_number
            FROM task_lines tl
            JOIN lines l ON tl.line_id = l.id
            WHERE tl.task_id = $1`,
            [task.id]
          );
          lines = taskLines.map((line) => ({
            id: line.line_id.toString(),
            name: line.line_number,
            completed: line.completed,
          }));
        }

        return {
          ...task,
          items,
          comments,
          lines: task.type === "Redline" ? lines : undefined,
        };
      })
    );

    res.status(200).json({ data: tasksWithDetails });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Create a new task
// @route   POST /api/tasks
const createTask = async (req, res) => {
  try {
    console.log("Raw request body:", req.body);
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ message: "Invalid request body" });
    }

    const { type, assigneeId, isComplex, items, projectId } = req.body;
    const description =
      typeof req.body.description === "string" ? req.body.description : "";
    console.log("Received task data:", req.body);
    console.log("Description value before validation:", description);

    if (!type || !assigneeId || !projectId) {
      return res
        .status(400)
        .json({ message: "Task type, assignee, and project ID are required" });
    }
    if (type !== "Misc" && (!items || items.length === 0)) {
      return res
        .status(400)
        .json({ message: "Items are required for this task type" });
    }
    if (type === "Misc") {
      if (
        !description ||
        typeof description !== "string" ||
        description.trim() === ""
      ) {
        console.log("Validation failed: Description is invalid");
        return res.status(400).json({
          message:
            "Description is required for Misc tasks and must be a non-empty string",
        });
      }
    }

    await db.query("BEGIN");

    const { rows: userRows } = await db.query(
      "SELECT id FROM users WHERE id = $1",
      [assigneeId]
    );
    if (userRows.length === 0) {
      await db.query("ROLLBACK");
      return res.status(400).json({ message: "Assignee not found" });
    }

    const { rows: projectRows } = await db.query(
      "SELECT id FROM projects WHERE id = $1",
      [projectId]
    );
    if (projectRows.length === 0) {
      await db.query("ROLLBACK");
      return res.status(400).json({ message: "Project not found" });
    }

    console.log("Creating task in database with description:", description);
    const { rows: taskRows } = await db.query(
      "INSERT INTO tasks (type, assignee_id, is_complex, status, progress, project_id, description) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [
        type,
        assigneeId,
        isComplex,
        "Assigned",
        0,
        projectId,
        type === "Misc" ? description : null,
      ]
    );

    const task = taskRows[0];

    if (type !== "Misc") {
      for (const item of items) {
        await db.query(
          "INSERT INTO task_items (task_id, item_id, item_type, item_name, completed) VALUES ($1, $2, $3, $4, $5)",
          [task.id, item.itemId, item.itemType, item.itemName, false]
        );
      }

      if (type === "Redline") {
        const pidItem = items.find((item) => item.itemType === "PID");
        if (pidItem) {
          const { rows: lines } = await db.query(
            "SELECT id FROM lines WHERE pid_id = $1",
            [pidItem.itemId]
          );
          for (const line of lines) {
            await db.query(
              "INSERT INTO task_lines (task_id, line_id, completed) VALUES ($1, $2, $3)",
              [task.id, line.id, false]
            );
          }
        }
      }
    }

    const assigneeName = userRows[0]?.name || "Unknown";
    const taskName =
      type === "Misc"
        ? `Misc Task`
        : items.map((item) => `${item.itemType} ${item.itemName}`).join(", ");
    if (req.user) {
      await db.query(
        "INSERT INTO audit_logs (type, name, created_by_id, current_work, timestamp) VALUES ($1, $2, $3, $4, $5)",
        [
          "Task Assignment",
          `${type} ${taskName}`,
          req.user.id,
          `${type} Task ${taskName}`,
          new Date(),
        ]
      );
    }

    await db.query("COMMIT");

    const { rows: detailedTasks } = await db.query(
      `
      SELECT t.*, u.name as assignee, p.name as project_name
      FROM tasks t 
      JOIN users u ON t.assignee_id = u.id 
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.id = $1`,
      [task.id]
    );

    const detailedTask = detailedTasks[0];
    detailedTask.items =
      type === "Misc"
        ? []
        : items.map((item) => ({
            id: item.itemId,
            item_id: item.itemId,
            item_type: item.itemType,
            item_name: item.itemName,
            completed: false,
          }));
    detailedTask.comments = [];

    res.status(201).json({ data: detailedTask });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Error creating task:", error);
    res
      .status(500)
      .json({ message: "Failed to create task", error: error.message });
  }
};

module.exports = { createTask }; // Export the function

// @desc    Update task status
// @route   PUT /api/tasks/:id/status
const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { role, id: userId } = req.user;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const validStatuses = ["Assigned", "In Progress", "Completed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    let query = "SELECT * FROM tasks WHERE id = $1";
    let params = [id];
    if (role === "Team Member") {
      query += " AND assignee_id = $2";
      params.push(userId);
    }

    const { rows } = await db.query(query, params);
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Task not found or not authorized" });
    }

    const task = rows[0];

    if (status === "Completed" && task.type !== "Misc") {
      const { rows: incompleteItems } = await db.query(
        "SELECT * FROM task_items WHERE task_id = $1 AND completed = false",
        [id]
      );
      if (incompleteItems.length > 0) {
        return res.status(400).json({
          message:
            "Cannot mark task as completed. Some items are not completed yet.",
        });
      }

      if (task.type === "Redline") {
        const { rows: incompleteLines } = await db.query(
          "SELECT * FROM task_lines WHERE task_id = $1 AND completed = false",
          [id]
        );
        if (incompleteLines.length > 0) {
          return res.status(400).json({
            message:
              "Cannot mark task as completed. Some lines are not completed yet.",
          });
        }
      }
    }

    const updatedTask = await db.query(
      "UPDATE tasks SET status = $1, updated_at = $2, completed_at = $3 WHERE id = $4 RETURNING *",
      [status, new Date(), status === "Completed" ? new Date() : null, id]
    );

    const { rows: items } = await db.query(
      "SELECT * FROM task_items WHERE task_id = $1",
      [id]
    );

    let lines = [];
    if (task.type === "Redline") {
      const { rows: taskLines } = await db.query(
        "SELECT * FROM task_lines WHERE task_id = $1",
        [id]
      );
      lines = taskLines;
    }

    if (req.user && status === "Completed") {
      const taskName =
        task.type === "Misc"
          ? `Misc Task`
          : items
              .map((item) => `${item.item_type} ${item.item_name}`)
              .join(", ");
      await db.query(
        "INSERT INTO audit_logs (type, name, created_by_id, current_work, timestamp) VALUES ($1, $2, $3, $4, $5)",
        [
          "Task Completion",
          `${task.type} ${taskName}`,
          req.user.id,
          `${task.type} Task ${taskName}`,
          new Date(),
        ]
      );
    }

    res.status(200).json({
      data: {
        ...updatedTask.rows[0],
        items,
        lines: task.type === "Redline" ? lines : undefined,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Update task item completion
// @route   PUT /api/tasks/:taskId/items/:itemId
const updateTaskItem = async (req, res) => {
  try {
    const { taskId, itemId } = req.params;
    const { completed } = req.body;
    const { role, id: userId } = req.user;

    // Check if task exists and user is authorized
    let query = "SELECT * FROM tasks WHERE id = $1";
    let params = [taskId];
    if (role === "Team Member") {
      query += " AND assignee_id = $2";
      params.push(userId);
    }

    const { rows: tasks } = await db.query(query, params);
    if (tasks.length === 0) {
      return res
        .status(404)
        .json({ message: "Task not found or not authorized" });
    }

    // Update the task item
    await db.query(
      "UPDATE task_items SET completed = $1 WHERE task_id = $2 AND id = $3",
      [completed, taskId, itemId]
    );

    // Recalculate progress
    const { rows: items } = await db.query(
      "SELECT * FROM task_items WHERE task_id = $1",
      [taskId]
    );

    const completedCount = items.filter((item) => item.completed).length;
    const progress = Math.round((completedCount / items.length) * 100);

    const { rows: taskRows } = await db.query(
      "UPDATE tasks SET progress = $1, updated_at = $2 WHERE id = $3 RETURNING *",
      [progress, new Date(), taskId]
    );

    res.status(200).json({ data: { ...taskRows[0], items } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Add a comment to a task
// @route   POST /api/tasks/:taskId/comments
const addTaskComment = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { comment } = req.body;
    const { id: userId, name, role } = req.user;

    if (!comment) {
      return res.status(400).json({ message: "Comment is required" });
    }

    const { rows } = await db.query(
      "INSERT INTO task_comments (task_id, user_id, user_name, user_role, comment) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [taskId, userId, name, role, comment]
    );

    res.status(201).json({ data: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getTasks,
  createTask,
  updateTaskStatus,
  updateTaskItem,
  addTaskComment,
};
