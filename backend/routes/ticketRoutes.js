const express = require('express');
const router = express.Router();
const {
  createTicket,
  getTickets,
  assignTicket,
  updateStatus,
  addMessage,
  requestClosure,
  handleClosureRequest,
  markAsIgnored,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  handleTicketDecision
} = require('../controllers/ticketController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(authMiddleware);

router.post('/', upload.single('file'), createTicket);
router.get('/', getTickets);
router.put('/assign', assignTicket);
router.put('/status', updateStatus);
router.put('/decision', handleTicketDecision);
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Advanced Features
router.post('/message', addMessage);
router.post('/closure-request', requestClosure);
router.put('/closure-approve', handleClosureRequest);
router.put('/mark-ignored', markAsIgnored);

module.exports = router;
