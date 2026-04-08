const express = require('express');
const router = express.Router();
const hrmsController = require('../controllers/hrmsController');
const hrmsSettingsController = require('../controllers/hrmsSettingsController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all HRMS routes
router.use(authMiddleware);

// Attendance
router.post('/attendance/check-in', hrmsController.checkIn);
router.post('/attendance/check-out', hrmsController.checkOut);
router.get('/attendance/status', hrmsController.getAttendanceStatus);
router.get('/attendance/history', hrmsController.getAttendanceHistory);
router.get('/attendance/bulk', hrmsController.getBulkAttendance);

// Leave Types
router.post('/leave-types', hrmsController.createLeaveType);
router.get('/leave-types', hrmsController.getLeaveTypes);
router.put('/leave-types/:id', hrmsController.updateLeaveType);
router.delete('/leave-types/:id', hrmsController.deleteLeaveType);

// Leaves
router.post('/leaves/apply', hrmsController.applyLeave);
router.get('/leaves', hrmsController.getLeaveRequests); 
router.put('/leaves/:id/status', hrmsController.updateLeaveStatus);

// Payroll
router.get('/payroll/preview', hrmsController.getPayrollPreview);
router.post('/payroll/generate', hrmsController.generatePayroll);
router.get('/payroll/history', hrmsController.getPayrollHistory);
router.put('/payroll/:id/status', hrmsController.updatePayrollStatus);
router.delete('/payroll/:id', hrmsController.deletePayroll);

// Profile
router.get('/profile/:userId', hrmsController.getEmployeeProfile);
router.post('/profile/:userId', hrmsController.updateEmployeeProfile);

// Work Logs
router.post('/work-logs', hrmsController.createWorkLog);
router.get('/work-logs', hrmsController.getWorkLogs);
router.put('/work-logs/:id', hrmsController.updateWorkLog);


// Settings - Designations & Departments
router.get('/designations', hrmsSettingsController.getDesignations);
router.post('/designations', hrmsSettingsController.createDesignation);
router.delete('/designations/:id', hrmsSettingsController.deleteDesignation);
router.get('/departments', hrmsSettingsController.getDepartments);
router.post('/departments', hrmsSettingsController.createDepartment);
router.delete('/departments/:id', hrmsSettingsController.deleteDepartment);

// Miss Punch Requests
const hrmsRequestsController = require('../controllers/hrmsRequestsController');
router.get('/miss-punch', hrmsRequestsController.getMissPunchRequests);
router.post('/miss-punch', hrmsRequestsController.createMissPunchRequest);
router.put('/miss-punch/:id/status', hrmsRequestsController.updateMissPunchStatus);

// Salary Advances
router.get('/salary-advance', hrmsRequestsController.getSalaryAdvances);
router.post('/salary-advance', hrmsRequestsController.createSalaryAdvance);
router.put('/salary-advance/:id/status', hrmsRequestsController.updateSalaryAdvanceStatus);

module.exports = router;
