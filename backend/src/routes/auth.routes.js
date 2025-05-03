
const express = require('express');
const { login, validateToken } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   POST api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', login);

// @route   GET api/auth/validate
// @desc    Validate token
// @access  Private
router.get('/validate', protect, validateToken);

module.exports = router;
