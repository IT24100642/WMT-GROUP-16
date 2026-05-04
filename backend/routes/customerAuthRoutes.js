const express = require('express');
const { registerCustomer, loginCustomer, getMe, updateMe, deleteMe } = require('../controllers/customerAuthController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', registerCustomer);
router.post('/login', loginCustomer);
router.get('/me', protect, authorize('customer'), getMe);
router.patch('/me', protect, authorize('customer'), updateMe);
router.delete('/me', protect, authorize('customer'), deleteMe);

const { 
  getMyBookings, createBooking, updateBooking, updateBookingCompat, cancelBooking, 
  createFoodOrder, createReview, updateReview, deleteReview 
} = require('../controllers/customerActionController');

// Customer Action Routes
router.get('/bookings', protect, authorize('customer'), getMyBookings);
router.post('/bookings', protect, authorize('customer'), createBooking);
router.put('/bookings/:id', protect, authorize('customer'), updateBooking);
router.patch('/bookings/:id', protect, authorize('customer'), updateBooking);
router.post('/bookings/:id/update', protect, authorize('customer'), updateBookingCompat);
router.post('/booking-update', protect, authorize('customer'), (req, res, next) => {
  req.params.id = req.body?.bookingId || req.body?.id;
  if (!req.params.id) {
    return res.status(400).json({ success: false, error: 'bookingId is required' });
  }
  return updateBookingCompat(req, res, next);
});
router.post('/bookings/:id/cancel', protect, authorize('customer'), cancelBooking);

router.post('/food-orders', protect, authorize('customer'), createFoodOrder);

router.post('/reviews', protect, authorize('customer'), createReview);
router.patch('/reviews/:id', protect, authorize('customer'), updateReview);
router.delete('/reviews/:id', protect, authorize('customer'), deleteReview);

module.exports = router;
