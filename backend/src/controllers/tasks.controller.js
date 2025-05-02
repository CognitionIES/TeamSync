const db = require('../config/db');

// @desc    Get all tasks
// @route   GET /api/tasks
// @access  Private
const getTasks = async (req, res) => {
  try {
    const { userId, role } = req.user;
    let query;
    let params = [];
    
    // Different queries based on role
    if (role === 'Team Member') {
      // Team members can only see their assigned tasks
      query = 'SELECT * FROM tasks WHERE assignee_id = $1';
      params = [userId];
    } else if (role === 'Team Lead') {
      // Team leads can see tasks for their team members
      // This assumes there's a team_members table that links leads to members
      query = `
        SELECT t.* FROM tasks t
        JOIN team_members tm ON t.assignee_id = tm.member_id
        WHERE tm.lead_id = $1
      `;
      params = [userId];
    } else {
      // Project managers and admins can see all tasks
      query = 'SELECT * FROM tasks';
    }
    
    const { rows } = await db.query(query, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get task by ID
// @route   GET /api/tasks/:id
// @access  Private
const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, userId } = req.user;
    
    // Base query to get task
    let query = 'SELECT * FROM tasks WHERE id = $1';
    let params = [id];
    
    // For team members, check if they are assigned to the task
    if (role === 'Team Member') {
      query += ' AND assignee_id = $2';
      params.push(userId);
    }
    
    const taskResult = await db.query(query, params);
    
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found or not authorized' });
    }
    
    const task = taskResult.rows[0];
    
    // Get task items
    const itemsResult = await db.query('SELECT * FROM task_items WHERE task_id = $1', [id]);
    task.items = itemsResult.rows;

    // Get task comments
    const commentsResult = await db.query(`
      SELECT tc.id, tc.user_id, tc.user_name, tc.user_role, tc.comment, tc.created_at 
      FROM task_comments tc 
      WHERE tc.task_id = $1 
      ORDER BY tc.created_at DESC
    `, [id]);
    
    task.comments = commentsResult.rows;
    
    // If task is Redline type, get all lines for the PID
    if (task.type === 'Redline') {
      // Find PID item
      const pidItem = itemsResult.rows.find(item => item.type === 'PID');
      
      if (pidItem) {
        // Get all lines for this PID
        const linesResult = await db.query(
          'SELECT * FROM lines WHERE pid_id = $1', 
          [pidItem.id]
        );
        
        // Add lines info to task
        task.pidLines = linesResult.rows;
      }
    }
    
    res.status(200).json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private (Team Lead, Project Manager, Admin)
const createTask = async (req, res) => {
  try {
    const { type, assigneeId, isComplex = false, items = [] } = req.body;
    
    if (!type || !assigneeId) {
      return res.status(400).json({ message: 'Please provide task type and assignee' });
    }
    
    // Start a transaction
    await db.query('BEGIN');
    
    // Create the task
    const taskResult = await db.query(
      `INSERT INTO tasks 
       (type, assignee_id, status, is_complex, created_at, updated_at, progress) 
       VALUES ($1, $2, $3, $4, NOW(), NOW(), $5) 
       RETURNING *`,
      [type, assigneeId, 'Assigned', isComplex, 0]
    );
    
    const task = taskResult.rows[0];
    
    // Add task items if provided
    if (items.length > 0) {
      for (const item of items) {
        await db.query(
          `INSERT INTO task_items 
           (task_id, name, type, completed) 
           VALUES ($1, $2, $3, $4)`,
          [task.id, item.name, item.type, false]
        );
      }
    }
    
    // Commit the transaction
    await db.query('COMMIT');
    
    // Get the complete task with items
    const completeTaskResult = await db.query(
      'SELECT * FROM tasks WHERE id = $1',
      [task.id]
    );
    
    const completeTask = completeTaskResult.rows[0];
    
    // Get task items
    const itemsResult = await db.query(
      'SELECT * FROM task_items WHERE task_id = $1',
      [task.id]
    );
    
    completeTask.items = itemsResult.rows;
    
    res.status(201).json(completeTask);
  } catch (error) {
    // Rollback in case of error
    await db.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update task status
// @route   PUT /api/tasks/:id/status
// @access  Private
const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { userId, role } = req.user;
    
    if (!status) {
      return res.status(400).json({ message: 'Please provide status' });
    }
    
    // Validate status
    const validStatuses = ['Assigned', 'In Progress', 'Completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    // Check if task exists and user is authorized
    let taskQuery = 'SELECT * FROM tasks WHERE id = $1';
    let taskParams = [id];
    
    // Team members can only update their assigned tasks
    if (role === 'Team Member') {
      taskQuery += ' AND assignee_id = $2';
      taskParams.push(userId);
    }
    
    const taskResult = await db.query(taskQuery, taskParams);
    
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found or not authorized' });
    }
    
    const task = taskResult.rows[0];
    
    // If status is Completed, check if all task items are completed
    if (status === 'Completed') {
      const itemsResult = await db.query(
        'SELECT * FROM task_items WHERE task_id = $1 AND completed = false',
        [id]
      );
      
      if (itemsResult.rows.length > 0) {
        return res.status(400).json({ 
          message: 'Cannot mark task as completed. Some items are not completed yet.' 
        });
      }
      
      // Update completed_at timestamp
      await db.query(
        'UPDATE tasks SET status = $1, updated_at = NOW(), completed_at = NOW() WHERE id = $2',
        [status, id]
      );
    } else {
      // Update status without completed_at
      await db.query(
        'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2',
        [status, id]
      );
    }
    
    // Get updated task
    const updatedTaskResult = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    const updatedTask = updatedTaskResult.rows[0];
    
    res.status(200).json(updatedTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update task progress
// @route   PUT /api/tasks/:id/progress
// @access  Private
const updateTaskProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemIds = [] } = req.body;
    const { userId, role } = req.user;
    
    // Check if task exists and user is authorized
    let taskQuery = 'SELECT * FROM tasks WHERE id = $1';
    let taskParams = [id];
    
    // Team members can only update their assigned tasks
    if (role === 'Team Member') {
      taskQuery += ' AND assignee_id = $2';
      taskParams.push(userId);
    }
    
    const taskResult = await db.query(taskQuery, taskParams);
    
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found or not authorized' });
    }
    
    // Start transaction
    await db.query('BEGIN');
    
    // Update task items
    for (const itemId of itemIds) {
      await db.query(
        'UPDATE task_items SET completed = true WHERE id = $1 AND task_id = $2',
        [itemId, id]
      );
    }
    
    // Calculate new progress percentage
    const totalItemsResult = await db.query(
      'SELECT COUNT(*) as total FROM task_items WHERE task_id = $1',
      [id]
    );
    
    const completedItemsResult = await db.query(
      'SELECT COUNT(*) as completed FROM task_items WHERE task_id = $1 AND completed = true',
      [id]
    );
    
    const totalItems = parseInt(totalItemsResult.rows[0].total);
    const completedItems = parseInt(completedItemsResult.rows[0].completed);
    
    // Calculate progress percentage
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    
    // Update task progress
    await db.query(
      'UPDATE tasks SET progress = $1, updated_at = NOW() WHERE id = $2',
      [progress, id]
    );
    
    // Commit transaction
    await db.query('COMMIT');
    
    // Get updated task with items
    const updatedTaskResult = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    const updatedItemsResult = await db.query('SELECT * FROM task_items WHERE task_id = $1', [id]);
    
    const updatedTask = updatedTaskResult.rows[0];
    updatedTask.items = updatedItemsResult.rows;
    
    res.status(200).json(updatedTask);
  } catch (error) {
    // Rollback in case of error
    await db.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update line items for redline tasks
// @route   PUT /api/tasks/:id/lines
// @access  Private
const updateTaskLines = async (req, res) => {
  try {
    const { id } = req.params;
    const { lineId, isCompleted } = req.body;
    const { userId, role } = req.user;
    
    // Check if task exists, is Redline type, and user is authorized
    let taskQuery = 'SELECT * FROM tasks WHERE id = $1 AND type = $2';
    let taskParams = [id, 'Redline'];
    
    // Team members can only update their assigned tasks
    if (role === 'Team Member') {
      taskQuery += ' AND assignee_id = $3';
      taskParams.push(userId);
    }
    
    const taskResult = await db.query(taskQuery, taskParams);
    
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ 
        message: 'Task not found, not a Redline task, or not authorized' 
      });
    }
    
    // Start transaction
    await db.query('BEGIN');
    
    // Check if line is already an item in the task
    const lineItemResult = await db.query(
      'SELECT * FROM task_items WHERE task_id = $1 AND id = $2 AND type = $3',
      [id, lineId, 'Line']
    );
    
    // If line exists as item, update it
    if (lineItemResult.rows.length > 0) {
      await db.query(
        'UPDATE task_items SET completed = $1 WHERE id = $2 AND task_id = $3',
        [isCompleted, lineId, id]
      );
    } else {
      // If not, get line info from lines table and add as new item
      const lineResult = await db.query('SELECT * FROM lines WHERE id = $1', [lineId]);
      
      if (lineResult.rows.length === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ message: 'Line not found' });
      }
      
      const line = lineResult.rows[0];
      
      await db.query(
        `INSERT INTO task_items 
         (task_id, id, name, type, completed) 
         VALUES ($1, $2, $3, $4, $5)`,
        [id, lineId, line.name, 'Line', isCompleted]
      );
    }
    
    // Calculate new progress percentage
    const totalItemsResult = await db.query(
      'SELECT COUNT(*) as total FROM task_items WHERE task_id = $1',
      [id]
    );
    
    const completedItemsResult = await db.query(
      'SELECT COUNT(*) as completed FROM task_items WHERE task_id = $1 AND completed = true',
      [id]
    );
    
    const totalItems = parseInt(totalItemsResult.rows[0].total);
    const completedItems = parseInt(completedItemsResult.rows[0].completed);
    
    // Calculate progress percentage
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    
    // Update task progress
    await db.query(
      'UPDATE tasks SET progress = $1, updated_at = NOW() WHERE id = $2',
      [progress, id]
    );
    
    // Commit transaction
    await db.query('COMMIT');
    
    // Get updated task with items
    const updatedTaskResult = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    const updatedItemsResult = await db.query('SELECT * FROM task_items WHERE task_id = $1', [id]);
    
    const updatedTask = updatedTaskResult.rows[0];
    updatedTask.items = updatedItemsResult.rows;
    
    res.status(200).json(updatedTask);
  } catch (error) {
    // Rollback in case of error
    await db.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Assign task
// @route   POST /api/tasks/assign
// @access  Private (Team Lead, Project Manager, Admin)
const assignTask = async (req, res) => {
  try {
    const { type, assignmentType, selectedItems, assigneeId, isComplex = false } = req.body;
    
    if (!type || !assignmentType || !selectedItems || !selectedItems.length || !assigneeId) {
      return res.status(400).json({ 
        message: 'Please provide task type, assignment type, items to assign, and assignee' 
      });
    }
    
    // Start a transaction
    await db.query('BEGIN');
    
    // Create the task
    const taskResult = await db.query(
      `INSERT INTO tasks 
       (type, assignee_id, status, is_complex, created_at, updated_at, progress) 
       VALUES ($1, $2, $3, $4, NOW(), NOW(), $5) 
       RETURNING *`,
      [type, assigneeId, 'Assigned', isComplex, 0]
    );
    
    const task = taskResult.rows[0];
    
    // Add task items
    for (const item of selectedItems) {
      await db.query(
        `INSERT INTO task_items 
         (task_id, name, type, completed) 
         VALUES ($1, $2, $3, $4)`,
        [task.id, item.name, assignmentType, false]
      );
    }
    
    // Commit the transaction
    await db.query('COMMIT');
    
    // Get the complete task with items
    const completeTaskResult = await db.query(
      'SELECT * FROM tasks WHERE id = $1',
      [task.id]
    );
    
    const completeTask = completeTaskResult.rows[0];
    
    // Get task items
    const itemsResult = await db.query(
      'SELECT * FROM task_items WHERE task_id = $1',
      [task.id]
    );
    
    completeTask.items = itemsResult.rows;
    
    res.status(201).json(completeTask);
  } catch (error) {
    // Rollback in case of error
    await db.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get lines for PID
// @route   GET /api/tasks/pid/:id/lines
// @access  Private
const getPidLines = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get all lines for this PID
    const linesResult = await db.query(
      'SELECT * FROM lines WHERE pid_id = $1 ORDER BY name', 
      [id]
    );
    
    res.status(200).json(linesResult.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get task comments
// @route   GET /api/tasks/:id/comments
// @access  Private
const getTaskComments = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get comments for this task
    const commentsResult = await db.query(`
      SELECT tc.id, tc.user_id, tc.user_name, tc.user_role, tc.comment, tc.created_at 
      FROM task_comments tc 
      WHERE tc.task_id = $1 
      ORDER BY tc.created_at DESC
    `, [id]);
    
    res.status(200).json(commentsResult.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add task comment
// @route   POST /api/tasks/:id/comments
// @access  Private
const addTaskComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const { userId, name, role } = req.user;
    
    if (!comment || comment.trim() === '') {
      return res.status(400).json({ message: 'Comment cannot be empty' });
    }
    
    // Check if task exists
    const taskResult = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Add comment
    const commentResult = await db.query(
      `INSERT INTO task_comments 
       (task_id, user_id, user_name, user_role, comment, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW()) 
       RETURNING *`,
      [id, userId, name, role, comment]
    );
    
    const newComment = commentResult.rows[0];
    
    res.status(201).json(newComment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTaskStatus,
  updateTaskProgress,
  updateTaskLines,
  assignTask,
  getPidLines,
  getTaskComments,
  addTaskComment
};
