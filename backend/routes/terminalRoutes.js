const express = require('express');
const router = express.Router();
const terminalController = require('../controllers/terminalController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', terminalController.getTerminals);
router.post('/register', terminalController.registerTerminal);
router.post('/bulk', terminalController.bulkCreateTerminals);
router.put('/:id', terminalController.updateTerminal);
router.delete('/:id', terminalController.deleteTerminal);
router.get('/settings', terminalController.getSettings);
router.post('/settings', terminalController.updateSettings);
router.get('/check', terminalController.checkTerminal);

module.exports = router;
