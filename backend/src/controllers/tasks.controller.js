const db = require("../config/db");

// @desc    Get all tasks for a user or all tasks
// @route   GET /api/tasks
// @route   GET /api/tasks/user/:userId
// @desc    Get all tasks for a user or all tasks
// @route   GET /api/tasks
// @route   GET /api/tasks/user/:userId
const getTasks = async (req, res) => {
  try {
    let query, params;
    const { role, id: userId } = req.user;
    console.log(`Fetching tasks for user: ${userId} with role: ${role}`);

    if (req.params.userId) {
      if (role === "Team Member" && req.params.userId != userId) {
        return res
          .status(403)
          .json({ message: "Not authorized to view tasks for other users" });
      }
      query = `
        SELECT t.id, t.type, t.assignee_id, t.status, t.is_complex, t.progress, 
               t.created_at, t.updated_at, t.completed_at, t.project_id, 
               t.description, u.name as assignee, p.name as project_name, 
               p2.pid_number, a.name as area_name
        FROM tasks t 
        JOIN users u ON t.assignee_id = u.id 
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN pids p2 ON p2.id = (
          SELECT item_id FROM task_items WHERE task_id = t.id AND item_type = 'PID' LIMIT 1
        )
        LEFT JOIN areas a ON p2.area_id = a.id
        WHERE t.assignee_id = $1`;
      params = [req.params.userId];
    } else if (role === "Team Lead") {
      query = `
        SELECT t.id, t.type, t.assignee_id, t.status, t.is_complex, t.progress, 
               t.created_at, t.updated_at, t.completed_at, t.project_id, 
               t.description, u.name as assignee, p.name as project_name, 
               p2.pid_number, a.name as area_name
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
        SELECT t.id, t.type, t.assignee_id, t.status, t.is_complex, t.progress, 
               t.created_at, t.updated_at, t.completed_at, t.project_id, 
               t.description, u.name as assignee, p.name as project_name, 
               p2.pid_number, a.name as area_name
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
        SELECT t.id, t.type, t.assignee_id, t.status, t.is_complex, t.progress, 
               t.created_at, t.updated_at, t.completed_at, t.project_id, 
               t.description, u.name as assignee, p.name as project_name, 
               p2.pid_number, a.name as area_name
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

    console.log("Executing query:", query, "with params:", params);
    const { rows: tasks } = await db.query(query, params);
    console.log("Raw tasks data from database:", tasks);

    // Fetch task items, comments, and lines for each task
    const tasksWithDetails = await Promise.all(
      tasks.map(async (task) => {
        const { rows: items } = await db.query(
          `
          SELECT id, item_id, item_type, name, completed, created_at
          FROM task_items 
          WHERE task_id = $1`,
          [task.id]
        );

        const formattedItems = items.map((item) => ({
          id: item.id.toString(),
          item_id: item.item_id.toString(),
          item_type: item.item_type,
          name: item.name,
          completed: item.completed,
          created_at: item.created_at ? item.created_at.toISOString() : null,
        }));

        const { rows: comments } = await db.query(
          `
          SELECT id, user_id, user_name, user_role, comment, created_at
          FROM task_comments 
          WHERE task_id = $1 
          ORDER BY created_at DESC`,
          [task.id]
        );

        const formattedComments = comments.map((comment) => ({
          id: comment.id.toString(),
          user_id: comment.user_id.toString(),
          user_name: comment.user_name,
          user_role: comment.user_role,
          comment: comment.comment,
          created_at: comment.created_at
            ? comment.created_at.toISOString()
            : null,
        }));

        let lines = [];
        if (task.type === "Redline") {
          const { rows: taskLines } = await db.query(
            `
            SELECT tl.id, tl.line_id, tl.completed, l.line_number
            FROM task_lines tl
            JOIN lines l ON tl.line_id = l.id
            WHERE tl.task_id = $1`,
            [task.id]
          );
          lines = taskLines.map((line) => ({
            id: line.id.toString(),
            line_id: line.line_id.toString(),
            name: line.line_number,
            completed: line.completed,
          }));
        }

        return {
          ...task,
          id: task.id.toString(),
          assignee_id: task.assignee_id.toString(),
          project_id: task.project_id ? task.project_id.toString() : null,
          created_at: task.created_at ? task.created_at.toISOString() : null,
          updated_at: task.updated_at ? task.updated_at.toISOString() : null,
          completed_at: task.completed_at
            ? task.completed_at.toISOString()
            : null,
          items: formattedItems,
          comments: formattedComments,
          lines: task.type === "Redline" ? lines : undefined,
        };
      })
    );

    res.status(200).json({ data: tasksWithDetails });
  } catch (error) {
    console.error("Error fetching tasks:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });
    res
      .status(500)
      .json({ message: "Failed to fetch tasks", error: error.message });
  }
};

// @desc    Create a new task
// @route   POST /api/tasks
// @desc    Create a new task
// @route   POST /api/tasks
const createTask = async (req, res) => {
  try {
    // ALLOW BOTH TEAM LEAD AND PROJECT MANAGER
    if (req.user.role !== "Team Lead" && req.user.role !== "Project Manager") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to create tasks`,
      });
    }


    console.log("Raw request body:", req.body);
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ message: "Invalid request body" });
    }

    const { type, assigneeId, isComplex, items, projectId } = req.body;
    const description =
      typeof req.body.description === "string" ? req.body.description : "";
    console.log("Received task data:", req.body);

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
        return res.status(400).json({
          message: "Description is required for Misc tasks and must be a non-empty string",
        });
      }
    }

    await db.query("BEGIN");

    // Verify assignee exists
    const { rows: userRows } = await db.query(
      "SELECT id, name FROM users WHERE id = $1",
      [assigneeId]
    );
    if (userRows.length === 0) {
      await db.query("ROLLBACK");
      return res.status(400).json({ message: "Assignee not found" });
    }

    // Verify project exists
    const { rows: projectRows } = await db.query(
      "SELECT id FROM projects WHERE id = $1",
      [projectId]
    );
    if (projectRows.length === 0) {
      await db.query("ROLLBACK");
      return res.status(400).json({ message: "Project not found" });
    }

    // Get area_id from first item
    let areaId = null;
    if (type !== "Misc" && items && items.length > 0) {
      const firstItem = items[0];

      if (firstItem.itemType === "Line") {
        const { rows: lineRows } = await db.query(
          "SELECT area_id FROM lines WHERE id = $1",
          [firstItem.itemId]
        );
        areaId = lineRows.length > 0 ? lineRows[0].area_id : null;
      } else if (firstItem.itemType === "Equipment") {
        const { rows: equipRows } = await db.query(
          "SELECT area_id FROM equipment WHERE id = $1",
          [firstItem.itemId]
        );
        areaId = equipRows.length > 0 ? equipRows[0].area_id : null;
      } else if (firstItem.itemType === "PID") {
        const { rows: pidRows } = await db.query(
          "SELECT area_id FROM pids WHERE id = $1",
          [firstItem.itemId]
        );
        areaId = pidRows.length > 0 ? pidRows[0].area_id : null;
      } else if (firstItem.itemType === "NonInlineInstrument") {
        const { rows: instrRows } = await db.query(
          "SELECT area_id FROM non_inline_instruments WHERE id = $1",
          [firstItem.itemId]
        );
        areaId = instrRows.length > 0 ? instrRows[0].area_id : null;
      }
    }

    // Create task
    const { rows: taskRows } = await db.query(
      "INSERT INTO tasks (type, assignee_id, is_complex, status, progress, project_id, description, area_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [
        type,
        assigneeId,
        isComplex,
        "Assigned",
        0,
        projectId,
        type === "Misc" ? description : null,
        areaId,
      ]
    );

    const task = taskRows[0];

    // Insert task items
    if (type !== "Misc") {
      for (const item of items) {
        await db.query(
          "INSERT INTO task_items (task_id, item_id, item_type, name, completed) VALUES ($1, $2, $3, $4, $5)",
          [task.id, item.itemId, item.itemType, item.itemName, false]
        );
      }

      // Handle Redline task lines
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

    // Create audit log
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
          `${type} Task assigned to ${assigneeName}`,
          new Date(),
        ]
      );
    }

    await db.query("COMMIT");

    // Fetch complete task details
    const { rows: detailedTasks } = await db.query(
      `SELECT t.*, u.name as assignee, p.name as project_name
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
          name: item.itemName,
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
// @desc    Update task item completion
// @route   PUT /api/tasks/:taskId/items/:itemId
const updateTaskItem = async (req, res) => {
  try {
    const { taskId, itemId } = req.params;
    const { completed } = req.body;
    const { role, id: userId } = req.user;

    console.log(`Updating item ${itemId} for task ${taskId} to completed=${completed}`);

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

    // Update the task item - ensure itemId is treated as a number
    const { rowCount } = await db.query(
      "UPDATE task_items SET completed = $1 WHERE task_id = $2 AND id = $3",
      [completed, parseInt(taskId), parseInt(itemId)]
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: "Task item not found" });
    }

    // Recalculate progress
    const { rows: items } = await db.query(
      "SELECT * FROM task_items WHERE task_id = $1",
      [parseInt(taskId)]
    );

    const completedCount = items.filter((item) => item.completed).length;
    const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

    const { rows: taskRows } = await db.query(
      "UPDATE tasks SET progress = $1, updated_at = $2 WHERE id = $3 RETURNING *",
      [progress, new Date(), parseInt(taskId)]
    );

    // Format the response consistently
    const formattedItems = items.map((item) => ({
      id: item.id.toString(),
      item_id: item.item_id.toString(),
      item_type: item.item_type,
      name: item.name,
      completed: item.completed,
      created_at: item.created_at ? item.created_at.toISOString() : null,
    }));

    res.status(200).json({
      data: {
        ...taskRows[0],
        id: taskRows[0].id.toString(),
        assignee_id: taskRows[0].assignee_id.toString(),
        project_id: taskRows[0].project_id ? taskRows[0].project_id.toString() : null,
        items: formattedItems
      }
    });
  } catch (error) {
    console.error("Error updating task item:", error.message, error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Add a comment to a task
// @route   POST /api/tasks/:taskId/comments
const addTaskComment = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { comment } = req.body;
    const { id: userId, name, role } = req.user;

    if (!comment || typeof comment !== "string" || comment.trim() === "") {
      return res.status(400).json({
        message: "Comment is required and must be a non-empty string",
      });
    }

    // Verify that the task exists
    const { rows: taskRows } = await db.query(
      "SELECT id FROM tasks WHERE id = $1",
      [taskId]
    );
    if (taskRows.length === 0) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Insert the comment
    const { rows } = await db.query(
      `
      INSERT INTO task_comments (task_id, user_id, user_name, user_role, comment, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING id, task_id, user_id, user_name, user_role, comment, created_at
      `,
      [taskId, userId, name, role, comment.trim()]
    );

    const newComment = rows[0];
    res.status(201).json({
      data: {
        id: newComment.id.toString(),
        taskId: newComment.task_id.toString(),
        userId: newComment.user_id.toString(),
        userName: newComment.user_name,
        userRole: newComment.user_role,
        comment: newComment.comment,
        createdAt: newComment.created_at.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error adding comment:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to add comment", error: error.message });
  }
};

module.exports = {
  getTasks,
  createTask,
  updateTaskStatus,
  updateTaskItem,
  addTaskComment,
};
