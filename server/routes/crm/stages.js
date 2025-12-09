// Stage routes
// This file will contain stage-related route definitions
const express = require('express');
const router = express.Router();
const {
  createStage,
  getStages,
  getStageById,
  updateStage,
  deleteStage,
  reorderStages
} = require('../../controllers/crm/stageController');

// Stage management routes
router.post('/', createStage);
router.get('/', getStages);
router.get('/:id', getStageById);
router.put('/:id', updateStage);
router.delete('/:id', deleteStage);
router.post('/reorder', reorderStages);

module.exports = router;