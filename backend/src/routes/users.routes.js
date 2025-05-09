const express = require('express');
const { 
  getUsers,
  getUserById,
  getUsersByRole,
  getTeamMembers,
  getUserByName,
} = require('../controllers/users.controller');
const { protect, authorize } = require('../middleware/auth');
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

// All routes below are protected
router.use(protect);

// Fetch team members (for Team Lead dashboard dropdown)
router.get('/team-members', authorize(['Team Lead']), getTeamMembers);

// Fetch user by name (for task assignment)
router.get('/by-name', authorize(['Team Lead']), getUserByName);

// Fetch all users (Admin and Project Manager can see all, others are scoped)
router.get('/', async (req, res) => {
  try {
    console.log("User role:", req.user.role);
    console.log("User ID:", req.user.id);

    if (['Admin', 'Project Manager'].includes(req.user.role)) {
      console.log("Fetching all users for Admin/Project Manager...");
      const { rows } = await db.query(
        `
        SELECT id, name, role
        FROM users
        `
      );
      console.log("Users fetched for Admin/Project Manager:", rows);
      return res.status(200).json({ data: rows });
    } else if (req.user.role === 'Team Lead') {
      console.log("Fetching team members for Team Lead ID:", req.user.id);
      const { rows } = await db.query(
        `
        SELECT u.id, u.name, u.role
        FROM users u
        WHERE u.id IN (
          SELECT tm.member_id
          FROM team_members tm
          WHERE tm.lead_id = $1
        )
        `,
        [req.user.id]
      );
      console.log("Users fetched for Team Lead:", rows);
      return res.status(200).json({ data: rows });
    } else if (req.user.role === 'Team Member') {
      console.log("Fetching self for Team Member ID:", req.user.id);
      const { rows } = await db.query(
        `
        SELECT id, name, role
        FROM users
        WHERE id = $1
        `,
        [req.user.id]
      );
      console.log("Users fetched for Team Member:", rows);
      return res.status(200).json({ data: rows });
    } else {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to perform this action`,
      });
    }
  } catch (error) {
    console.error("Error fetching users:", error.message, error.stack);
    res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
});

// Get specific user (Admin only)
router.get('/:id', authorize(['Admin']), getUserById);

module.exports = router;