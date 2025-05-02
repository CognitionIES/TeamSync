const express = require('express');
const { 
  getUsers,
  getUserById,
  getUsersByRole
} = require('../controllers/users.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const db = require('../config/db');

const router = express.Router();

// Public test route to fetch all users (no authentication required)
router.get('/test', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM users');
    res.status(200).json({ message: 'Database query successful', data: rows });
  } catch (error) {
    res.status(500).json({ message: 'Database query failed', error: error.message });
  }
});

// Public route to fetch users by role (needed for login page dropdown)
router.get('/role/:role', getUsersByRole);

// All routes below are protected and limited to Admin
router.use(protect);

// Get all users (Admin only)
router.get('/', authorize(['Admin']), getUsers);

// Get specific user
router.get('/:id', getUserById);

module.exports = router;