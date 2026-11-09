
const express = require('express');
const router = express.Router();

const {
  initiatePayment,
  checkPaymentStatus
} = require('../controllers/rentPaymentController');

// Add your existing authentication and order-ownership
// middleware before these controller functions.
router.post('/:orderId/initiate', initiatePayment);
router.get('/:orderId/status', checkPaymentStatus);

module.exports = router;
