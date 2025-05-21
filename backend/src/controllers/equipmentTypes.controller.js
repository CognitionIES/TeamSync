const db = require("../config/db");

// @desc    Get all equipment types
// @route   GET /api/equipment-types
const getEquipmentTypes = async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM equipment_types");
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getEquipmentTypes };