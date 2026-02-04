const express = require('express');
const router = express.Router();
const stateController = require('../controllers/stateController');
const authenticate = require('../middleware/authMiddleware');

router.get('/', authenticate, stateController.getStates);
router.post('/', authenticate, stateController.createState);
router.put('/:id', authenticate, stateController.updateState);
router.delete('/:id', authenticate, stateController.deleteState);

module.exports = router;
