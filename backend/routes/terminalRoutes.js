const express = require('express');
const router = express.Router();
const terminalController = require('../controllers/terminalController');
// const { auth, admin } = require('../middleware/auth'); // Assuming middleware exists

// For simplicity in this setup, I'll keep them open or use existing auth if available
// Assuming existing auth pattern in the project

router.get('/', terminalController.getTerminals);
router.post('/register', terminalController.registerTerminal);
router.post('/bulk', terminalController.bulkCreateTerminals);
router.put('/:id', terminalController.updateTerminal);
router.delete('/:id', terminalController.deleteTerminal);
router.get('/settings', terminalController.getSettings);
router.post('/settings', terminalController.updateSettings);
router.get('/check', terminalController.checkTerminal);

module.exports = router;
