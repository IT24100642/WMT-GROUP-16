const express = require('express');
const {
  getStaff, createStaff, deleteStaff,
  getShifts, createShift, updateShift, deleteShift,
  getSummaryReports, getAdminIssues, bootstrapPortalStaff
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

// Staff Routes
router.route('/staff')
  .get(getStaff)
  .post(createStaff);
router.post('/staff/bootstrap', bootstrapPortalStaff);
router.delete('/staff/:id', deleteStaff);

// Shifts Routes
router.route('/shifts')
  .get(getShifts)
  .post(createShift);
router.patch('/shifts/:id', updateShift);
router.delete('/shifts/:id', deleteShift);

// Admin / Reports
router.get('/reports/summary', getSummaryReports);
router.get('/admin/issues', getAdminIssues);
router.patch('/admin/issues/:id', require('../controllers/adminController').updateAdminIssue);

module.exports = router;
