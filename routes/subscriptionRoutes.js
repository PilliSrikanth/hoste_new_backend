const express = require('express');
const router = express.Router();

const subscriptionController =
  require('../controllers/subscriptionController');

const ownerAuth = require('../middleware/ownerAuth');

// Public plans
router.get('/plans', subscriptionController.getPlans);

// Owner subscription
router.get(
  '/my',
  ownerAuth,
  subscriptionController.getMySubscription
);

// Create Cashfree order
router.post(
  '/create-order',
  ownerAuth,
  subscriptionController.createOrder
);

// Verify Cashfree payment
router.post(
  '/verify/:orderId',
  ownerAuth,
  subscriptionController.verifyPayment
);

// Cashfree webhook
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  subscriptionController.webhook
);

// Admin creates plans
router.post(
  '/create-plan',
  ownerAuth,
  subscriptionController.createPlan
);

module.exports = router;

