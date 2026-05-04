const express = require('express');
const { loginStaff, getMe } = require('../controllers/staffPortalController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', loginStaff);
router.get('/me', protect, authorize('staff'), getMe);

const {
  getRooms, getRoom, addRoomPhoto, updateRoom,
  getOffers, createOffer, updateOffer, deleteOffer,
  getReviews, getReviewAnalytics, updateReview, deleteReview,
  getBookings, rejectCancellation, approveCancellation,
  getFoodItems, createFoodItem, updateFoodItem, deleteFoodItem, getFoodOrders, updateFoodOrder,
  getCustomers, getCustomerDetails, updateCustomer, addLoyaltyPoints, deletePreferences, deleteCustomer
} = require('../controllers/staffActionController');

// Staff Actions (assuming any staff can access these for now, or you could add specific roleName checks)
router.get('/rooms', protect, authorize('staff', 'admin'), getRooms);
router.get('/rooms/:id', protect, authorize('staff', 'admin'), getRoom);
router.patch('/rooms/:id', protect, authorize('staff', 'admin'), updateRoom);
router.post('/rooms/:id/photos-by-url', protect, authorize('staff', 'admin'), addRoomPhoto);

router.get('/offers', protect, authorize('staff', 'admin'), getOffers);
router.post('/offers', protect, authorize('staff', 'admin'), createOffer);
router.patch('/offers/:id', protect, authorize('staff', 'admin'), updateOffer);
router.delete('/offers/:id', protect, authorize('staff', 'admin'), deleteOffer);

router.get('/reviews', protect, authorize('staff', 'admin'), getReviews);
router.get('/reviews/analytics', protect, authorize('staff', 'admin'), getReviewAnalytics);
router.patch('/reviews/:id', protect, authorize('staff', 'admin'), updateReview);
router.delete('/reviews/:id', protect, authorize('staff', 'admin'), deleteReview);

router.get('/bookings', protect, authorize('staff', 'admin'), getBookings);
router.post('/bookings/:id/cancellation-request/reject', protect, authorize('staff', 'admin'), rejectCancellation);
router.post('/bookings/:id/cancellation-request/approve', protect, authorize('staff', 'admin'), approveCancellation);

router.get('/kitchen/food-items', protect, authorize('staff', 'admin'), getFoodItems);
router.post('/kitchen/food-items', protect, authorize('staff', 'admin'), createFoodItem);
router.patch('/kitchen/food-items/:id', protect, authorize('staff', 'admin'), updateFoodItem);
router.delete('/kitchen/food-items/:id', protect, authorize('staff', 'admin'), deleteFoodItem);
router.get('/kitchen/food-orders', protect, authorize('staff', 'admin'), getFoodOrders);
router.patch('/kitchen/food-orders/:id', protect, authorize('staff', 'admin'), updateFoodOrder);

router.get('/customers', protect, authorize('staff', 'admin'), getCustomers);
router.get('/customers/:id/details', protect, authorize('staff', 'admin'), getCustomerDetails);
router.patch('/customers/:id', protect, authorize('staff', 'admin'), updateCustomer);
router.post('/customers/:id/loyalty-points', protect, authorize('staff', 'admin'), addLoyaltyPoints);
router.delete('/customers/:id/preferences', protect, authorize('staff', 'admin'), deletePreferences);
router.delete('/customers/:id', protect, authorize('staff', 'admin'), deleteCustomer);

module.exports = router;
