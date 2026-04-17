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
  handleTicketDecision,
  acceptTicket,
  reassignTicket,
  completeTicket,
  getBranchCustomers,
  getBranchAdmins,
  getBranchAgents,
  getTicketDashboardStats
} = require('../controllers/ticketController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(authMiddleware);

router.get('/stats', getTicketDashboardStats);
router.post('/', upload.single('file'), createTicket);
router.get('/', getTickets);
router.put('/assign', assignTicket);
router.put('/status', updateStatus);
router.put('/decision', handleTicketDecision);
router.get('/categories', getCategories);
router.get('/branch-customers', getBranchCustomers);
router.get('/branch-admins', getBranchAdmins);
router.get('/branch-agents', getBranchAgents);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Advanced Features
router.post('/message', addMessage);
router.post('/closure-request', requestClosure);
router.put('/closure-approve', handleClosureRequest);
router.put('/mark-ignored', markAsIgnored);

// Staff Actions
router.post('/accept', acceptTicket);
router.post('/reassign', reassignTicket);
router.put('/:id/reassign', reassignTicket);
router.post('/complete', completeTicket);

module.exports = router;
