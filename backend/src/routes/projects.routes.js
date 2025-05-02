
const express = require('express');
const { 
  getProjects, 
  getProjectById, 
  createProject, 
  createArea,
  createPID,
  createLine,
  createEquipment
} = require('../controllers/projects.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes are protected
router.use(protect);

// Project routes
router.get('/', getProjects);
router.get('/:id', getProjectById);
router.post('/', createProject);

// Area routes
router.post('/:projectId/areas', createArea);

// PID routes
router.post('/:projectId/areas/:areaId/pids', createPID);

// Line routes
router.post('/:projectId/areas/:areaId/pids/:pidId/lines', createLine);

// Equipment routes
router.post('/:projectId/areas/:areaId/equipment', createEquipment);

module.exports = router;
