const express = require('express');
const router = express.Router();
const stateController = require('../controllers/stateController');
const authenticate = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', stateController.getStates);
router.post('/', stateController.createState);
router.put('/:id', stateController.updateState);
router.delete('/:id', stateController.deleteState);

module.exports = router;
