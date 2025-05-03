const db = require('../config/db');

// @desc    Get all line types
// @route   GET /api/line-types
const getLineTypes = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM line_types');
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getLineTypes };