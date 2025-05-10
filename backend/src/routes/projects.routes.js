const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect, authorize } = require("../middleware/auth");

// @desc    Get all projects
// @route   GET /api/projects
// @access  Private (Admin, Team Lead, Data Entry)
router.get("/", protect, async (req, res) => {
  try {
    // Allow Admin, Team Lead, and Data Entry roles to access projects
    if (
      req.user.role !== "Admin" &&
      req.user.role !== "Team Lead" &&
      req.user.role !== "Data Entry" &&
      req.user.role !== "Team Member"
    ) {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to view projects`,
      });
    }

    const { rows } = await db.query(
      "SELECT id, name FROM projects ORDER BY name ASC"
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message:
          "No projects found. Please contact an Admin to create a project.",
      });
    }

    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching projects:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private
router.post("/", protect, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Project name is required" });
    }

    const { rows } = await db.query(
      "INSERT INTO projects (name) VALUES ($1) RETURNING *",
      [name]
    );

    // Log the action in audit logs
    if (req.user) {
      await db.query(
        "INSERT INTO audit_logs (type, name, created_by_id, current_work, timestamp) VALUES ($1, $2, $3, $4, $5)",
        ["Project Creation", name, req.user.id, `Project ${name}`, new Date()]
      );
    }

    res.status(201).json({ data: rows[0] });
  } catch (error) {
    console.error("Error creating project:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @desc    Get project by ID
// @route   GET /api/projects/:id
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;

    const projectResult = await db.query(
      "SELECT * FROM projects WHERE id = $1",
      [id]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    const project = projectResult.rows[0];

    // Get areas
    const areasResult = await db.query(
      "SELECT * FROM areas WHERE project_id = $1",
      [id]
    );
    project.areas = areasResult.rows;

    // For each area, get P&IDs and equipment
    for (const area of project.areas) {
      const pidsResult = await db.query(
        "SELECT * FROM pids WHERE area_id = $1",
        [area.id]
      );
      area.pids = pidsResult.rows;

      // For each P&ID, get lines
      for (const pid of area.pids) {
        const linesResult = await db.query(
          "SELECT * FROM lines WHERE pid_id = $1",
          [pid.id]
        );
        pid.lines = linesResult.rows;
      }

      const equipmentResult = await db.query(
        "SELECT * FROM equipment WHERE area_id = $1",
        [area.id]
      );
      area.equipment = equipmentResult.rows;
    }

    res.status(200).json({ data: project });
  } catch (error) {
    console.error("Error fetching project by ID:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @desc    Get all P&IDs for a project
// @route   GET /api/projects/pids/project/:projectId
// @access  Private
router.get("/pids/project/:projectId", protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { rows } = await db.query(
      "SELECT * FROM pids WHERE project_id = $1",
      [projectId]
    );
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching P&IDs for project:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @desc    Create a new P&ID
// @route   POST /api/projects/pids
// @access  Private
router.post("/pids", protect, async (req, res) => {
  try {
    const { pidNumber, description, areaId, projectId } = req.body;
    if (!pidNumber || !projectId) {
      return res
        .status(400)
        .json({ message: "PID number and project ID are required" });
    }

    const { rows } = await db.query(
      "INSERT INTO pids (pid_number, description, area_id, project_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [pidNumber, description, areaId, projectId]
    );

    // Log the action in audit logs
    if (req.user) {
      await db.query(
        "INSERT INTO audit_logs (type, name, created_by_id, current_work, timestamp) VALUES ($1, $2, $3, $4, $5)",
        [
          "P&ID Creation",
          pidNumber,
          req.user.id,
          `P&ID ${pidNumber}`,
          new Date(),
        ]
      );
    }

    res.status(201).json({ data: rows[0] });
  } catch (error) {
    console.error("Error creating P&ID:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @desc    Get all lines for a project or PID
// @route   GET /api/projects/lines/project/:projectId
// @route   GET /api/projects/lines/pid/:pidId
// @access  Private
router.get("/lines/project/:projectId", protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { rows } = await db.query(
      "SELECT * FROM lines WHERE project_id = $1",
      [projectId]
    );
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching lines for project:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/lines/pid/:pidId", protect, async (req, res) => {
  try {
    const { pidId } = req.params;
    const { rows } = await db.query("SELECT * FROM lines WHERE pid_id = $1", [
      pidId,
    ]);
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching lines for PID:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @desc    Create a new line
// @route   POST /api/projects/lines
// @access  Private
router.post("/lines", protect, async (req, res) => {
  try {
    const { lineNumber, description, typeId, pidId, projectId } = req.body;
    if (!lineNumber || !projectId || !pidId) {
      return res
        .status(400)
        .json({ message: "Line number, project ID, and PID ID are required" });
    }

    const { rows } = await db.query(
      "INSERT INTO lines (line_number, description, type_id, pid_id, project_id, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [lineNumber, description, typeId, pidId, projectId, "Assigned"]
    );

    // Log the action in audit logs
    if (req.user) {
      await db.query(
        "INSERT INTO audit_logs (type, name, created_by_id, current_work, timestamp) VALUES ($1, $2, $3, $4, $5)",
        [
          "Line Creation",
          lineNumber,
          req.user.id,
          `Line ${lineNumber}`,
          new Date(),
        ]
      );
    }

    res.status(201).json({ data: rows[0] });
  } catch (error) {
    console.error("Error creating line:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @desc    Get all equipment for a project
// @route   GET /api/projects/equipment/project/:projectId
// @access  Private
router.get("/equipment/project/:projectId", protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { rows } = await db.query(
      "SELECT * FROM equipment WHERE project_id = $1",
      [projectId]
    );
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching equipment for project:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @desc    Create a new equipment
// @route   POST /api/projects/equipment
// @access  Private
router.post("/equipment", protect, async (req, res) => {
  try {
    const { equipmentNumber, description, typeId, areaId, projectId } =
      req.body;
    if (!equipmentNumber || !projectId) {
      return res
        .status(400)
        .json({ message: "Equipment number and project ID are required" });
    }

    const { rows } = await db.query(
      "INSERT INTO equipment (equipment_number, description, type_id, area_id, project_id, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [equipmentNumber, description, typeId, areaId, projectId, "Assigned"]
    );

    // Log the action in audit logs
    if (req.user) {
      await db.query(
        "INSERT INTO audit_logs (type, name, created_by_id, current_work, timestamp) VALUES ($1, $2, $3, $4, $5)",
        [
          "Equipment Creation",
          equipmentNumber,
          req.user.id,
          `Equipment ${equipmentNumber}`,
          new Date(),
        ]
      );
    }

    res.status(201).json({ data: rows[0] });
  } catch (error) {
    console.error("Error creating equipment:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
