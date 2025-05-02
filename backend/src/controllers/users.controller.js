const getUsers = async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM users");
    res.status(200).json({ message: "Fetched all users", data: rows });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching users", error: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM users WHERE id = $1", [
      req.params.id,
    ]);
    res.status(200).json({ message: "Fetched user", data: rows[0] });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching user", error: error.message });
  }
};

const getUsersByRole = async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM users WHERE role = $1", [
      req.params.role,
    ]);
    res.status(200).json({ message: "Fetched users by role", data: rows });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching users by role", error: error.message });
  }
};

module.exports = { getUsers, getUserById, getUsersByRole };
