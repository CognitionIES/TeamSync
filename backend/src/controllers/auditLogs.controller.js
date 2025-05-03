const db = require('../config/db');

// @desc    Get all audit logs
// @route   GET /api/audit-logs
const getAuditLogs = async (req, res) => {
  try {
    const { rows } = await db.query(
      `
      SELECT al.*, u.name as created_by 
      FROM audit_logs al 
      JOIN users u ON al.created_by_id = u.id 
      ORDER BY al.timestamp DESC`
    );
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getAuditLogs };