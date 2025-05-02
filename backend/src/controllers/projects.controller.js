
const db = require('../config/db');

// @desc    Get all projects
// @route   GET /api/projects
// @access  Private
const getProjects = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM projects');
    res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get project by ID
// @route   GET /api/projects/:id
// @access  Private
const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const projectResult = await db.query('SELECT * FROM projects WHERE id = $1', [id]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    const project = projectResult.rows[0];
    
    // Get areas
    const areasResult = await db.query('SELECT * FROM areas WHERE project_id = $1', [id]);
    project.areas = areasResult.rows;
    
    // For each area, get PIDs, lines and equipment
    for (const area of project.areas) {
      const pidsResult = await db.query('SELECT * FROM pids WHERE area_id = $1', [area.id]);
      area.pids = pidsResult.rows;
      
      // For each PID, get lines
      for (const pid of area.pids) {
        const linesResult = await db.query('SELECT * FROM lines WHERE pid_id = $1', [pid.id]);
        pid.lines = linesResult.rows;
      }
      
      // Get equipment for area
      const equipmentResult = await db.query('SELECT * FROM equipment WHERE area_id = $1', [area.id]);
      area.equipment = equipmentResult.rows;
    }
    
    res.status(200).json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private
const createProject = async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Please provide project name' });
    }
    
    const { rows } = await db.query(
      'INSERT INTO projects (name) VALUES ($1) RETURNING *',
      [name]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create a new area
// @route   POST /api/projects/:projectId/areas
// @access  Private
const createArea = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Please provide area name' });
    }
    
    // Check if project exists
    const projectResult = await db.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    const { rows } = await db.query(
      'INSERT INTO areas (name, project_id) VALUES ($1, $2) RETURNING *',
      [name, projectId]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create a new PID
// @route   POST /api/projects/:projectId/areas/:areaId/pids
// @access  Private
const createPID = async (req, res) => {
  try {
    const { areaId } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Please provide PID name' });
    }
    
    // Check if area exists
    const areaResult = await db.query('SELECT * FROM areas WHERE id = $1', [areaId]);
    
    if (areaResult.rows.length === 0) {
      return res.status(404).json({ message: 'Area not found' });
    }
    
    const { rows } = await db.query(
      'INSERT INTO pids (name, area_id) VALUES ($1, $2) RETURNING *',
      [name, areaId]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create a new line
// @route   POST /api/projects/:projectId/areas/:areaId/pids/:pidId/lines
// @access  Private
const createLine = async (req, res) => {
  try {
    const { pidId } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Please provide line name' });
    }
    
    // Check if PID exists
    const pidResult = await db.query('SELECT * FROM pids WHERE id = $1', [pidId]);
    
    if (pidResult.rows.length === 0) {
      return res.status(404).json({ message: 'PID not found' });
    }
    
    const { rows } = await db.query(
      'INSERT INTO lines (name, pid_id, status) VALUES ($1, $2, $3) RETURNING *',
      [name, pidId, 'Assigned']
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create new equipment
// @route   POST /api/projects/:projectId/areas/:areaId/equipment
// @access  Private
const createEquipment = async (req, res) => {
  try {
    const { areaId } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Please provide equipment name' });
    }
    
    // Check if area exists
    const areaResult = await db.query('SELECT * FROM areas WHERE id = $1', [areaId]);
    
    if (areaResult.rows.length === 0) {
      return res.status(404).json({ message: 'Area not found' });
    }
    
    const { rows } = await db.query(
      'INSERT INTO equipment (name, area_id, status) VALUES ($1, $2, $3) RETURNING *',
      [name, areaId, 'Assigned']
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  createArea,
  createPID,
  createLine,
  createEquipment
};
