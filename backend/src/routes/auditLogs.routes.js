const express = require('express');
const { getAuditLogs } = require('../controllers/auditLogs.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getAuditLogs);

module.exports = router;