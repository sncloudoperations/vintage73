const express = require('express');
const router = express.Router();
const crmController = require('../controllers/crmController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Leads
router.post('/leads', crmController.createLead);
router.get('/leads', crmController.getLeads);
router.get('/followups', crmController.getFollowUps);
router.get('/leads/:id', crmController.getLeadById);
router.put('/leads/:id', crmController.updateLead);
router.put('/leads/:id/status', crmController.updateLeadStatus);
router.post('/leads/:id/activities', crmController.addLeadActivity);
router.post('/leads/:id/followups', crmController.scheduleFollowUp);
router.post('/leads/:id/convert-quotation', crmController.convertToQuotation);
router.post('/leads/:id/convert-order', crmController.convertToOrder);
router.delete('/leads/:id', crmController.deleteLead);



// Deals
router.post('/deals', crmController.createDeal);
router.get('/deals', crmController.getDeals);
router.put('/deals/:id', crmController.updateDeal);
router.delete('/deals/:id', crmController.deleteDeal);

// Tasks
router.post('/tasks', crmController.createTask);
router.get('/tasks', crmController.getTasks);
router.put('/tasks/:id', crmController.updateTask);

// Dashboard
router.get('/dashboard', crmController.getDashboardStats);

module.exports = router;
