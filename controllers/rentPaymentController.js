
const axios = require('axios');
const RentPayment = require('../models/RentPayment');

const COSMIC_BASE_URL = 'https://merchant.cosmicpayments.in';

const cosmicHeaders = () => ({
  'X-API-Key': process.env.COSMICPAY_API_KEY,
  'X-Secret-Key': process.env.COSMICPAY_SECRET_KEY,
  Origin: process.env.COSMICPAY_MERCHANT_ORIGIN,
  Referer: process.env.COSMICPAY_MERCHANT_REFERER,
  Accept: 'application/json',
  'Content-Type': 'application/json'
});

// Find the payment using the order ID from the URL.
async function findRentPayment(req, res) {
  const orderId = String(req.params.orderId || '').trim();

  if (!orderId) {
    res.status(400).json({
      success: false,
      message: 'Order ID is required'
    });
    return null;
  }

  console.log('Cosmic Pay order lookup:', {
    orderId,
    database: RentPayment.db.name,
    collection: RentPayment.collection.name
  });

  const payment = await RentPayment.findOne({ orderId });

  if (!payment) {
    console.error('Rent payment not found:', orderId);

    res.status(404).json({
      success: false,
      message: 'Rent payment order not found',
      requestedOrderId: orderId
    });

    return null;
  }

  return payment;
}

// POST /api/cosmic-payments/:orderId/initiate
exports.initiatePayment = async (req, res) => {
  try {
    const payment = await findRentPayment(req, res);
    if (!payment) return;

    if (payment.paymentStatus === 'paid') {
      return res.status(409).json({
        success: false,
        message: 'This order is already paid'
      });
    }

    const amount = Number(payment.amount);

    if (!Number.isInteger(amount) || amount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Order amount must be a whole number of rupees'
      });
    }

    if (
      !process.env.COSMICPAY_API_KEY ||
      !process.env.COSMICPAY_SECRET_KEY ||
      !process.env.COSMICPAY_REDIRECT_URL
    ) {
      console.error('Cosmic Pay environment variables are missing');

      return res.status(500).json({
        success: false,
        message: 'Cosmic Pay configuration is incomplete'
      });
    }

    const redirectUrl = new URL(
      process.env.COSMICPAY_REDIRECT_URL
    );

    redirectUrl.searchParams.set(
      'orderId',
      String(payment.orderId)
    );

    const response = await axios.post(
      `${COSMIC_BASE_URL}/api/payment/initiate`,
      {
        amount,
        order_id: String(payment.orderId),
        redirect_url: redirectUrl.toString()
      },
      {
        headers: cosmicHeaders(),
        timeout: 30000
      }
    );

    const data = response.data;

    if (
      data.status !== 'success' ||
      !data.token ||
      !data.payment_url
    ) {
      console.error('Unexpected Cosmic Pay response:', data);

      return res.status(502).json({
        success: false,
        message: 'Cosmic Pay did not create a payment session'
      });
    }

    payment.cosmicToken = data.token;
    payment.paymentStatus = 'pending';
    await payment.save();

    return res.status(200).json({
      success: true,
      orderId: payment.orderId,
      paymentUrl: data.payment_url,
      expiresAt: data.expires_at,
      amount: data.total_amount
    });
  } catch (error) {
    console.error(
      'Cosmic Pay initiate error:',
      error.response?.data || error.message
    );

    return res.status(502).json({
      success: false,
      message: 'Unable to initiate payment with Cosmic Pay'
    });
  }
};

// GET /api/cosmic-payments/:orderId/status
exports.checkPaymentStatus = async (req, res) => {
  try {
    const payment = await findRentPayment(req, res);
    if (!payment) return;

    if (payment.paymentStatus === 'paid') {
      return res.json({
        success: true,
        orderId: payment.orderId,
        paymentStatus: 'paid',
        utr: payment.utr || null
      });
    }

    if (!payment.cosmicToken) {
      return res.status(400).json({
        success: false,
        message: 'No Cosmic Pay session exists for this order'
      });
    }

    const response = await axios.get(
      `${COSMIC_BASE_URL}/api/payment/status/` +
        encodeURIComponent(payment.cosmicToken),
      {
        headers: {
          'X-API-Key': process.env.COSMICPAY_API_KEY,
          Origin: process.env.COSMICPAY_MERCHANT_ORIGIN,
          Referer: process.env.COSMICPAY_MERCHANT_REFERER,
          Accept: 'application/json'
        },
        timeout: 15000
      }
    );

    const data = response.data;

    // Confirm both provider status and matching order ID.
    if (
      data.status === 'success' &&
      String(data.order_id) === String(payment.orderId)
    ) {
      payment.paymentStatus = 'paid';
      payment.utr = data.utr || '';
      await payment.save();
    } else if (
      ['expired', 'cancelled'].includes(data.status)
    ) {
      payment.paymentStatus = data.status;
      await payment.save();
    }

    return res.json({
      success: true,
      orderId: payment.orderId,
      paymentStatus: payment.paymentStatus || data.status,
      utr: payment.utr || null
    });
  } catch (error) {
    console.error(
      'Cosmic Pay status error:',
      error.response?.data || error.message
    );

    return res.status(502).json({
      success: false,
      message: 'Unable to verify payment status'
    });
  }
};
