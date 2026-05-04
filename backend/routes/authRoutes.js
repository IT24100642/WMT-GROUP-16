const express = require('express');
const { adminLogin } = require('../controllers/authController');

const router = express.Router();

router.post('/login', adminLogin);
router.post('/change-password', require('../controllers/authController').changePassword);

module.exports = router;
