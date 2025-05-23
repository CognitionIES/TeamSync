const db = require("../config/db");

// @desc    Get all tasks for a user or all tasks
// @route   GET /api/tasks
// @route   GET /api/tasks/user/:userId
const getTasks = async (req, res) => {
  try {
    let query, params;
    const { role, id: userId } = req.user;

    if (req.params.userId) {
      // Team Members can only see their own tasks
      if (role === "Team Member" && req.params.userId != userId) {
        return res
          .status(403)
          .json({ message: "Not authorized to view tasks for other users" });
      }
      query = `
        SELECT t.*, u.name as assignee 
        FROM tasks t 
        JOIN users u ON t.assignee_id = u.id 
        WHERE t.assignee_id = $1`;
      params = [req.params.userId];
    } else if (role === "Team Lead") {
      // Team Leads can see tasks for their team members
      query = `
        SELECT t.*, u.name as assignee 
        FROM tasks t 
        JOIN users u ON t.assignee_id = u.id 
        JOIN team_members tm ON t.assignee_id = tm.member_id 
        WHERE tm.lead_id = $1`;
      params = [userId];
    } else if (role === "Project Manager" || role === "Admin") {
      // Project Managers and Admins can see all tasks
      query = `
        SELECT t.*, u.name as assignee 
        FROM tasks t 
        JOIN users u ON t.assignee_id = u.id`;
      params = [];
    } else {
      // Team Members can only see their own tasks
      query = `
        SELECT t.*, u.name as assignee 
        FROM tasks t 
        JOIN users u ON t.assignee_id = u.id 
        WHERE t.assignee_id = $1`;
      params = [userId];
    }

    const { rows: tasks } = await db.query(query, params);

    // Fetch task items and comments for each task
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

        return {
          ...task,
          items,
          comments,
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
    const { type, assigneeId, isComplex, items } = req.body;
    if (!type || !assigneeId || !items || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Task type, assignee, and items are required" });
    }

    // Start a transaction
    await db.query("BEGIN");

    // Create the task
    const { rows: taskRows } = await db.query(
      "INSERT INTO tasks (type, assignee_id, is_complex, status, progress) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [type, assigneeId, isComplex, "Assigned", 0]
    );

    const task = taskRows[0];

    // Create task items
    for (const item of items) {
      await db.query(
        "INSERT INTO task_items (task_id, item_id, item_type, item_name, completed) VALUES ($1, $2, $3, $4, $5)",
        [task.id, item.itemId, item.itemType, item.itemName, false]
      );
    }

    // Fetch assignee name for audit log
    const { rows: userRows } = await db.query(
      "SELECT name FROM users WHERE id = $1",
      [assigneeId]
    );
    const assigneeName = userRows[0]?.name || "Unknown";

    // Log the action in audit logs
    const taskName = items
      .map((item) => `${item.itemType} ${item.itemName}`)
      .join(", ");
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

    // Commit the transaction
    await db.query("COMMIT");

    // Fetch the task with details
    const { rows: detailedTasks } = await db.query(
      `
      SELECT t.*, u.name as assignee 
      FROM tasks t 
      JOIN users u ON t.assignee_id = u.id 
      WHERE t.id = $1`,
      [task.id]
    );

    const detailedTask = detailedTasks[0];
    detailedTask.items = items.map((item) => ({
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
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

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

    // Validate status
    const validStatuses = ["Assigned", "In Progress", "Completed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // Check if task exists and user is authorized
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

    // If status is Completed, check if all task items are completed
    if (status === "Completed") {
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
    }

    // Update task status
    const updatedTask = await db.query(
      "UPDATE tasks SET status = $1, updated_at = $2, completed_at = $3 WHERE id = $4 RETURNING *",
      [status, new Date(), status === "Completed" ? new Date() : null, id]
    );

    // Fetch task items
    const { rows: items } = await db.query(
      "SELECT * FROM task_items WHERE task_id = $1",
      [id]
    );

    // Log the action in audit logs
    if (req.user && status === "Completed") {
      const taskName = items
        .map((item) => `${item.item_type} ${item.item_name}`)
        .join(", ");
      await db.query(
        "INSERT INTO audit_logs (type, name, created_by_id, current_work, timestamp) VALUES ($1, $2, $3, $4, $5)",
        [
          "Task Completion",
          `${rows[0].type} ${taskName}`,
          req.user.id,
          `${rows[0].type} Task ${taskName}`,
          new Date(),
        ]
      );
    }

    res.status(200).json({ data: { ...updatedTask.rows[0], items } });
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
