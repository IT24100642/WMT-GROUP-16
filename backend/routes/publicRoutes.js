const express = require('express');
const { getRooms, getFoodItems, getReviews, getOffers } = require('../controllers/publicController');

const router = express.Router();

router.get('/rooms', getRooms);
router.get('/food-items', getFoodItems);
router.get('/reviews', getReviews);
router.get('/offers', getOffers);

module.exports = router;
