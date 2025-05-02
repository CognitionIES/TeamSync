
const express = require('express');
const { 
  getTasks,
  getTaskById, 
  createTask, 
  updateTaskStatus,
  updateTaskProgress,
  updateTaskLines,
  assignTask,
  getTaskComments,
  addTaskComment,
  getPidLines
} = require('../controllers/tasks.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes are protected
router.use(protect);

// Get all tasks
router.get('/', getTasks);

// Get specific task
router.get('/:id', getTaskById);

// Create task (Team Lead or higher)
router.post('/', authorize(['Team Lead', 'Project Manager', 'Admin']), createTask);

// Assign task (Team Lead or higher)
router.post('/assign', authorize(['Team Lead', 'Project Manager', 'Admin']), assignTask);

// Update task status
router.put('/:id/status', updateTaskStatus);

// Update task progress
router.put('/:id/progress', updateTaskProgress);

// Update task lines (for Redline tasks)
router.put('/:id/lines', updateTaskLines);

// Get lines for PID
router.get('/pid/:id/lines', getPidLines);

// Task comments
router.get('/:id/comments', getTaskComments);
router.post('/:id/comments', addTaskComment);

module.exports = router;
