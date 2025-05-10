const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// @desc    Get all areas for a project
// @route   GET /api/areas/project/:projectId
// @access  Private
router.get("/project/:projectId", protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { rows } = await db.query(
      "SELECT * FROM areas WHERE project_id = $1",
      [projectId]
    );
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching areas for project:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @desc    Create a new area
// @route   POST /api/areas
// @access  Private

// POST /api/areas - Create a new area
router.post("/", protect, async (req, res) => {
  try {
    console.log("User role:", req.user.role);
    console.log("User ID:", req.user.id);
    console.log("Request body:", req.body); // Log the request body for debugging

    // Restrict access to Data Entry role
    if (req.user.role !== "Data Entry") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to create areas`,
      });
    }

    const { name, project_id } = req.body;

    // Validate input
    if (!name || !project_id) {
      return res
        .status(400)
        .json({ message: "Name and project_id are required" });
    }

    // Verify project_id exists
    const projectCheck = await db.query(
      "SELECT id FROM projects WHERE id = $1",
      [project_id]
    );
    if (projectCheck.rows.length === 0) {
      return res.status(400).json({ message: "Invalid project_id" });
    }

    // Insert the new area into the database
    const query = `
      INSERT INTO areas (name, project_id, created_at)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const values = [name, project_id, new Date()]; // Removed created_by_id

    const { rows } = await db.query(query, values);

    console.log("Area created:", rows[0]);
    res.status(201).json({ data: rows[0] });
  } catch (error) {
    console.error("Error creating area:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to create area", error: error.message });
  }
});

module.exports = router;
