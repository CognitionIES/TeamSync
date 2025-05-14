const db = require("../config/db");

// @desc    Get all projects
// @route   GET /api/projects
const getProjects = async (req, res) => {
  try {
    const projects = await db.query("SELECT * FROM projects");
    res.status(200).json({ data: projects.rows }); // Ensure the response is wrapped in "data"
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Create a new project
// @route   POST /api/projects
const createProject = async (req, res) => {
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
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get project by ID
// @route   GET /api/projects/:id
const getProjectById = async (req, res) => {
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
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get all areas for a project
// @route   GET /api/areas/project/:projectId
const getAreasByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { rows } = await db.query(
      "SELECT * FROM areas WHERE project_id = $1",
      [projectId]
    );
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Create a new area
// @route   POST /api/areas
const createArea = async (req, res) => {
  try {
    const { name, projectId } = req.body;
    if (!name || !projectId) {
      return res
        .status(400)
        .json({ message: "Name and project ID are required" });
    }

    const { rows } = await db.query(
      "INSERT INTO areas (name, project_id) VALUES ($1, $2) RETURNING *",
      [name, projectId]
    );

    // Log the action in audit logs
    if (req.user) {
      await db.query(
        "INSERT INTO audit_logs (type, name, created_by_id, current_work, timestamp) VALUES ($1, $2, $3, $4, $5)",
        ["Area Creation", name, req.user.id, `Area ${name}`, new Date()]
      );
    }

    res.status(201).json({ data: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get all P&IDs for a project
// @route   GET /api/pids/project/:projectId
const getPIDsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { rows } = await db.query(
      "SELECT * FROM pids WHERE project_id = $1",
      [projectId]
    );
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Create a new P&ID
// @route   POST /api/pids
const createPID = async (req, res) => {
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
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get all lines for a project or PID
// @route   GET /api/lines/project/:projectId
// @route   GET /api/lines/pid/:pidId
const getLines = async (req, res) => {
  try {
    let query, params;
    if (req.params.pidId) {
      query = "SELECT * FROM lines WHERE pid_id = $1";
      params = [req.params.pidId];
    } else {
      query = "SELECT * FROM lines WHERE project_id = $1";
      params = [req.params.projectId];
    }

    const { rows } = await db.query(query, params);
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Create a new line
// @route   POST /api/lines
const createLine = async (req, res) => {
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
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get all equipment for a project
// @route   GET /api/equipment/project/:projectId
const getEquipmentByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { rows } = await db.query(
      "SELECT * FROM equipment WHERE project_id = $1",
      [projectId]
    );
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Create a new equipment
// @route   POST /api/equipment
const createEquipment = async (req, res) => {
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
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getProjects,
  createProject,
  getProjectById,
  getAreasByProject,
  createArea,
  getPIDsByProject,
  createPID,
  getLines,
  createLine,
  getEquipmentByProject,
  createEquipment,
};
