
const crypto = require('crypto');
const mongoose = require('mongoose');
const { Cashfree, CFEnvironment } = require('cashfree-pg');

const SubscriptionPlan = require('../models/SubscriptionPlan');
const OwnerSubscription = require('../models/OwnerSubscription');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const Owner = require('../models/ownerModel');
const Hostel = require('../models/hostelModel');

// --------------------------------------------------
// CASHFREE CONFIGURATION
// --------------------------------------------------

if (
  !process.env.CASHFREE_CLIENT_ID ||
  !process.env.CASHFREE_CLIENT_SECRET
) {
  throw new Error(
    'Cashfree credentials are missing from environment variables'
  );
}

const cashfree = new Cashfree(
  process.env.CASHFREE_ENV === 'PRODUCTION'
    ? CFEnvironment.PRODUCTION
    : CFEnvironment.SANDBOX,
  process.env.CASHFREE_CLIENT_ID.trim(),
  process.env.CASHFREE_CLIENT_SECRET.trim()
);

const CURRENCY = 'INR';
const PROCESSING_TIMEOUT_MINUTES = 3;

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function getOwnerId(req) {
  const user = req.owner || req.user;

  if (!user) {
    console.log('Subscription: authenticated owner not found');
    return null;
  }

  const role = String(
    user.role ||
    user.userType ||
    user.user_type ||
    ''
  ).toLowerCase();

  if (role !== 'owner') {
    console.log('Subscription: invalid role:', role);
    return null;
  }

  const ownerId =
    user.ownerId ||
    user._id ||
    user.id ||
    user.userId;

  if (
    !ownerId ||
    !mongoose.Types.ObjectId.isValid(String(ownerId))
  ) {
    console.log('Subscription: invalid owner ID');
    return null;
  }

  return ownerId;
}

function createOrderId() {
  return `SUB_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}

function getFrontendUrl() {
  return (
    process.env.FRONTEND_URL || 'http://localhost:4200'
  ).replace(/\/+$/, '');
}

function validId(id) {
  return Boolean(
    id && mongoose.Types.ObjectId.isValid(String(id))
  );
}

function getCashfreeError(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    'Cashfree request failed'
  );
}

function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    message
  });
}

// Verify hostel belongs to authenticated owner.
async function getOwnedHostel(hostelId, ownerId) {
  if (!validId(hostelId) || !validId(ownerId)) {
    return null;
  }

  return Hostel.findOne({
    _id: hostelId,
    ownerId
  });
}

// Verify Cashfree order directly from backend.
async function fetchAndValidateCashfreeOrder(payment) {
  const response = await cashfree.PGFetchOrder(payment.orderId);
  const order = response?.data;

  if (!order) {
    throw new Error('Unable to retrieve order from Cashfree');
  }

  if (
    Number(order.order_amount) !== Number(payment.amount) ||
    String(order.order_currency).toUpperCase() !==
      String(payment.currency).toUpperCase()
  ) {
    throw new Error('Cashfree payment amount or currency mismatch');
  }

  return order;
}

// --------------------------------------------------
// ACTIVATE SUBSCRIPTION FOR ONE HOSTEL
// --------------------------------------------------

async function activateSubscription(paymentId) {
  if (!validId(paymentId)) {
    throw new Error('Invalid subscription payment ID');
  }

  const payment = await SubscriptionPayment.findById(paymentId);

  if (!payment) {
    throw new Error('Subscription payment record not found');
  }

  if (
    !payment.hostelId ||
    !payment.ownerId ||
    !payment.planId
  ) {
    throw new Error(
      'Payment is missing owner, hostel or plan information'
    );
  }

  // Verify exact hostel ownership.
  const hostel = await Hostel.findOne({
    _id: payment.hostelId,
    ownerId: payment.ownerId
  });

  if (!hostel) {
    throw new Error(
      'The hostel linked to this payment was not found'
    );
  }

  // Prevent duplicate activation for an already paid order.
  if (payment.status === 'PAID') {
    const existingSubscription = await OwnerSubscription.findOne({
      ownerId: payment.ownerId,
      hostelId: payment.hostelId
    });

    if (
      existingSubscription &&
      existingSubscription.lastPaymentOrderId === payment.orderId
    ) {
      await Hostel.updateOne(
        {
          _id: payment.hostelId,
          ownerId: payment.ownerId
        },
        {
          $set: {
            subscriptionStatus: 'ACTIVE',
            isPublished: true,
            subscriptionId: existingSubscription._id
          }
        }
      );
    }

    return payment;
  }

  // Cashfree server-side verification.
  const order = await fetchAndValidateCashfreeOrder(payment);

  if (order.order_status !== 'PAID') {
    return payment;
  }

  const plan = await SubscriptionPlan.findById(payment.planId);

  if (!plan) {
    throw new Error(
      'Subscription plan associated with this payment was not found'
    );
  }

  const durationDays = Number(plan.durationDays);

  if (
    !Number.isInteger(durationDays) ||
    durationDays <= 0
  ) {
    throw new Error('Subscription plan has an invalid duration');
  }

  // Claim payment to prevent simultaneous activation.
  const staleProcessingTime = new Date(
    Date.now() - PROCESSING_TIMEOUT_MINUTES * 60 * 1000
  );

  const claimedPayment = await SubscriptionPayment.findOneAndUpdate(
    {
      _id: payment._id,
      $or: [
        { status: 'PENDING' },
        {
          status: 'PROCESSING',
          updatedAt: { $lte: staleProcessingTime }
        }
      ]
    },
    {
      $set: {
        status: 'PROCESSING'
      }
    },
    {
      new: true
    }
  );

  if (!claimedPayment) {
    const latestPayment = await SubscriptionPayment.findById(
      payment._id
    );

    if (latestPayment?.status === 'PAID') {
      return latestPayment;
    }

    if (latestPayment?.status === 'PROCESSING') {
      throw new Error(
        'Payment activation is already in progress. Please retry shortly.'
      );
    }

    return latestPayment || payment;
  }

  let session;

  try {
    session = await mongoose.startSession();

    let finalPayment = null;

    await session.withTransaction(async () => {
      const currentPayment = await SubscriptionPayment.findOne({
        _id: claimedPayment._id,
        status: 'PROCESSING'
      }).session(session);

      if (!currentPayment) {
        throw new Error(
          'Payment is no longer available for activation'
        );
      }

      // Find subscription for this exact hostel and owner.
      let subscription = await OwnerSubscription.findOne({
        ownerId: currentPayment.ownerId,
        hostelId: currentPayment.hostelId
      }).session(session);

      // Avoid extending the same payment twice.
      if (
        subscription &&
        subscription.lastPaymentOrderId === currentPayment.orderId
      ) {
        await Hostel.updateOne(
          {
            _id: currentPayment.hostelId,
            ownerId: currentPayment.ownerId
          },
          {
            $set: {
              subscriptionStatus: 'ACTIVE',
              isPublished: true,
              subscriptionId: subscription._id
            }
          },
          { session }
        );

        currentPayment.status = 'PAID';
        currentPayment.subscriptionId = subscription._id;
        currentPayment.paidAt =
          currentPayment.paidAt || new Date();
        currentPayment.verifiedAt = new Date();

        await currentPayment.save({ session });

        finalPayment = currentPayment;
        return;
      }

      const now = new Date();

      // Extend an unexpired subscription for this hostel only.
      const startDate =
        subscription &&
        subscription.status === 'ACTIVE' &&
        subscription.endDate &&
        new Date(subscription.endDate) > now
          ? new Date(subscription.endDate)
          : now;

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + durationDays);

      if (!subscription) {
        subscription = new OwnerSubscription({
          ownerId: currentPayment.ownerId,
          hostelId: currentPayment.hostelId
        });
      }

      subscription.ownerId = currentPayment.ownerId;
      subscription.hostelId = currentPayment.hostelId;
      subscription.planId = currentPayment.planId;
      subscription.status = 'ACTIVE';
      subscription.startDate = startDate;
      subscription.endDate = endDate;
      subscription.lastPaymentOrderId = currentPayment.orderId;

      await subscription.save({ session });

      // Publish ONLY the hostel linked to this payment.
      const hostelUpdate = await Hostel.updateOne(
        {
          _id: currentPayment.hostelId,
          ownerId: currentPayment.ownerId
        },
        {
          $set: {
            subscriptionStatus: 'ACTIVE',
            isPublished: true,
            subscriptionId: subscription._id
          }
        },
        { session }
      );

      if (hostelUpdate.matchedCount !== 1) {
        throw new Error(
          'Unable to activate the hostel linked to this payment'
        );
      }

      currentPayment.status = 'PAID';
      currentPayment.subscriptionId = subscription._id;
      currentPayment.paidAt =
        currentPayment.paidAt || new Date();
      currentPayment.verifiedAt = new Date();

      await currentPayment.save({ session });

      finalPayment = currentPayment;
    });

    if (!finalPayment) {
      throw new Error('Subscription activation did not complete');
    }

    return finalPayment;

  } catch (error) {
    // Allow retry if activation failed.
    await SubscriptionPayment.updateOne(
      {
        _id: claimedPayment._id,
        status: 'PROCESSING'
      },
      {
        $set: {
          status: 'PENDING'
        }
      }
    );

    throw error;

  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

// --------------------------------------------------
// GET /api/subscriptions/plans
// --------------------------------------------------

exports.getPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({
      active: true
    }).sort({ price: 1 });

    return res.json({
      success: true,
      plans
    });

  } catch (error) {
    console.error('Get plans error:', error);

    return sendError(
      res,
      500,
      'Failed to fetch subscription plans'
    );
  }
};

// --------------------------------------------------
// GET /api/subscriptions/my?hostelId=HOSTEL_ID
// --------------------------------------------------

exports.getMySubscription = async (req, res) => {
  try {
    const ownerId = getOwnerId(req);
    const { hostelId } = req.query;

    if (!ownerId) {
      return sendError(
        res,
        401,
        'Owner authentication required'
      );
    }

    if (!validId(hostelId)) {
      return sendError(
        res,
        400,
        'Valid hostelId is required'
      );
    }

    const hostel = await getOwnedHostel(hostelId, ownerId);

    if (!hostel) {
      return sendError(
        res,
        404,
        'Hostel not found or does not belong to this owner'
      );
    }

    let subscription = await OwnerSubscription.findOne({
      ownerId,
      hostelId
    });

    // Expire only this hostel when its subscription has ended.
    if (
      subscription &&
      subscription.status === 'ACTIVE' &&
      subscription.endDate &&
      new Date(subscription.endDate) <= new Date()
    ) {
      subscription.status = 'EXPIRED';
      await subscription.save();

      await Hostel.updateOne(
        {
          _id: hostelId,
          ownerId,
          subscriptionId: subscription._id
        },
        {
          $set: {
            subscriptionStatus: 'EXPIRED',
            isPublished: false
          }
        }
      );
    }

    subscription = subscription
      ? await OwnerSubscription.findById(subscription._id)
          .populate('planId')
      : null;

    const active = Boolean(
      subscription &&
      subscription.status === 'ACTIVE' &&
      subscription.endDate &&
      new Date(subscription.endDate) > new Date() &&
      hostel.isPublished === true &&
      hostel.subscriptionStatus === 'ACTIVE'
    );

    return res.json({
      success: true,
      hostelId: String(hostelId),
      hostelStatus: hostel.subscriptionStatus,
      isPublished: hostel.isPublished,
      subscription,
      active,
      expired: Boolean(
        subscription &&
        subscription.status === 'EXPIRED'
      ),
      redirectTo: active
        ? '/home'
        : '/subscription-plans'
    });

  } catch (error) {
    console.error('Get hostel subscription error:', error);

    return sendError(
      res,
      500,
      'Failed to fetch hostel subscription'
    );
  }
};

// --------------------------------------------------
// POST /api/subscriptions/create-order
// BODY: { hostelId, planId }
// --------------------------------------------------

exports.createOrder = async (req, res) => {
  try {
    console.log('CREATE SUBSCRIPTION ORDER BODY:', req.body);

    const ownerId = getOwnerId(req);

    if (!ownerId) {
      return sendError(
        res,
        401,
        'Owner authentication required'
      );
    }

    const { hostelId, planId } = req.body || {};

    // Both IDs are compulsory.
    if (!validId(hostelId) || !validId(planId)) {
      return sendError(
        res,
        400,
        'Valid hostelId and planId are required'
      );
    }

    // Verify the owner, selected plan and selected hostel.
    const [owner, plan, hostel] = await Promise.all([
      Owner.findById(ownerId),

      SubscriptionPlan.findOne({
        _id: planId,
        active: true
      }),

      getOwnedHostel(hostelId, ownerId)
    ]);

    if (!owner) {
      return sendError(
        res,
        404,
        'Owner account not found'
      );
    }

    if (!hostel) {
      return sendError(
        res,
        404,
        'Hostel not found or does not belong to this owner'
      );
    }

    if (!plan) {
      return sendError(
        res,
        404,
        'Subscription plan not found or inactive'
      );
    }

    if (!owner.email || !owner.mobile) {
      return sendError(
        res,
        400,
        'Owner email and mobile number are required'
      );
    }

    // Validate Indian phone number.
    const phoneDigits = String(owner.mobile).replace(/\D/g, '');

    const customerPhone =
      phoneDigits.length === 12 && phoneDigits.startsWith('91')
        ? phoneDigits.slice(2)
        : phoneDigits;

    if (!/^[6-9]\d{9}$/.test(customerPhone)) {
      return sendError(
        res,
        400,
        'Owner must have a valid 10-digit Indian mobile number'
      );
    }

    const amount = Number(plan.price);

    if (!Number.isFinite(amount) || amount <= 0) {
      return sendError(
        res,
        400,
        'Subscription plan price must be greater than zero'
      );
    }

    const orderId = createOrderId();
    const frontendUrl = getFrontendUrl();

    const request = {
      order_id: orderId,
      order_amount: amount,
      order_currency: CURRENCY,

      customer_details: {
        customer_id: String(owner._id),
        customer_name: owner.name || 'Owner',
        customer_email: owner.email,
        customer_phone: customerPhone
      },

      order_meta: {
        return_url:
          `${frontendUrl}/subscription-plans` +
          `?hostelId=${encodeURIComponent(String(hostel._id))}` +
          `&order_id={order_id}`
      },

      order_note:
        `Hostel subscription: ${hostel.name || hostel.title || hostelId} - ${plan.name}`
    };

    // Create Cashfree order.
    const cashfreeResponse =
      await cashfree.PGCreateOrder(request);

    const cashfreeOrder = cashfreeResponse?.data;

    if (!cashfreeOrder?.payment_session_id) {
      return res.status(502).json({
        success: false,
        message: 'Cashfree did not return a payment session'
      });
    }

    // Save the exact hostel, owner and plan against this order.
    const payment = await SubscriptionPayment.create({
      ownerId: owner._id,
      hostelId: hostel._id,
      planId: plan._id,
      orderId,
      paymentSessionId: cashfreeOrder.payment_session_id,
      amount,
      currency: CURRENCY,
      status: 'PENDING'
    });

    return res.status(201).json({
      success: true,
      message: 'Hostel subscription order created successfully',

      paymentId: String(payment._id),
      hostelId: String(hostel._id),
      planId: String(plan._id),

      orderId,

      paymentSessionId:
        cashfreeOrder.payment_session_id,

      paymentStatus: cashfreeOrder.order_status,

      amount,
      currency: CURRENCY
    });

  } catch (error) {
    console.error(
      'Cashfree create-order error:',
      error.response?.data || error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to create subscription order',
      error: getCashfreeError(error)
    });
  }
};

// --------------------------------------------------
// POST /api/subscriptions/verify/:orderId
// --------------------------------------------------

exports.verifyPayment = async (req, res) => {
  try {
    const ownerId = getOwnerId(req);

    if (!ownerId) {
      return sendError(
        res,
        401,
        'Owner authentication required'
      );
    }

    const orderId = req.params.orderId;

    if (!orderId) {
      return sendError(
        res,
        400,
        'Order ID is required'
      );
    }

    // Find payment belonging to this authenticated owner.
    const payment = await SubscriptionPayment.findOne({
      orderId,
      ownerId
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        paymentStatus: 'NOT_FOUND',
        message: 'Subscription payment order not found'
      });
    }

    const hostel = await getOwnedHostel(
      payment.hostelId,
      ownerId
    );

    if (!hostel) {
      return sendError(
        res,
        404,
        'Hostel not found or does not belong to this owner'
      );
    }

    // Verify order directly with Cashfree.
    const order = await fetchAndValidateCashfreeOrder(payment);

    if (order.order_status !== 'PAID') {
      return res.status(409).json({
        success: false,
        paymentStatus: order.order_status || payment.status,
        message: 'Cashfree has not confirmed the order as PAID yet',
        hostelId: String(payment.hostelId)
      });
    }

    const updatedPayment = await activateSubscription(payment._id);

    const [subscription, updatedHostel] = await Promise.all([
      OwnerSubscription.findOne({
        ownerId,
        hostelId: payment.hostelId
      }).populate('planId'),

      Hostel.findOne({
        _id: payment.hostelId,
        ownerId
      })
    ]);

    const active = Boolean(
      updatedPayment?.status === 'PAID' &&
      subscription?.status === 'ACTIVE' &&
      subscription.endDate &&
      new Date(subscription.endDate) > new Date() &&
      updatedHostel?.isPublished === true &&
      updatedHostel?.subscriptionStatus === 'ACTIVE'
    );

    return res.status(active ? 200 : 409).json({
      success: active,
      message: active
        ? 'Payment verified and hostel subscription activated successfully'
        : 'Payment was received but subscription activation is still pending',

      paymentStatus: updatedPayment?.status || 'PENDING',
      orderId: payment.orderId,
      hostelId: String(payment.hostelId),

      subscription,
      hostel: updatedHostel,
      active,

      redirectTo: active
        ? '/home'
        : '/subscription-plans'
    });

  } catch (error) {
    console.error('Payment verification failed:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to verify payment'
    });
  }
};

// --------------------------------------------------
// CASHFREE WEBHOOK
// POST /api/subscriptions/webhook
// --------------------------------------------------

exports.webhook = async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];

    if (!signature || !timestamp || !req.rawBody) {
      return res.status(400).send(
        'Missing webhook signature data'
      );
    }

    const expectedSignature = crypto
      .createHmac(
        'sha256',
        process.env.CASHFREE_CLIENT_SECRET
      )
      .update(timestamp + req.rawBody.toString('utf8'))
      .digest('base64');

    const expectedBuffer = Buffer.from(expectedSignature);
    const receivedBuffer = Buffer.from(String(signature));

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(
        expectedBuffer,
        receivedBuffer
      )
    ) {
      return res.status(401).send(
        'Invalid webhook signature'
      );
    }

    let webhookBody = req.body;

    if (!webhookBody || typeof webhookBody !== 'object') {
      webhookBody = JSON.parse(
        req.rawBody.toString('utf8')
      );
    }

    const orderId = webhookBody?.data?.order?.order_id;

    if (!orderId) {
      return res.status(200).send('Webhook received');
    }

    const payment = await SubscriptionPayment.findOne({
      orderId
    });

    if (!payment) {
      console.warn(
        'Cashfree webhook order not found:',
        orderId
      );

      return res.status(200).send('Unknown order ignored');
    }

    // activateSubscription independently verifies Cashfree order.
    await activateSubscription(payment._id);

    return res.status(200).send('Webhook processed');

  } catch (error) {
    console.error('Cashfree webhook error:', error);

    return res.status(500).send(
      'Webhook processing failed'
    );
  }
};

// --------------------------------------------------
// POST /api/subscriptions/create-plan
// Protect with ADMIN authentication.
// --------------------------------------------------

exports.createPlan = async (req, res) => {
  try {
    const {
      name,
      price,
      durationDays,
      features,
      propertyLimit
    } = req.body;

    if (
      typeof name !== 'string' ||
      !name.trim() ||
      price === undefined ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0 ||
      !Number.isInteger(Number(durationDays)) ||
      Number(durationDays) <= 0 ||
      propertyLimit === undefined ||
      !Number.isInteger(Number(propertyLimit)) ||
      Number(propertyLimit) < 0
    ) {
      return sendError(
        res,
        400,
        'Name, valid price, durationDays and propertyLimit are required'
      );
    }

    const plan = await SubscriptionPlan.create({
      name: name.trim(),
      price: Number(price),
      durationDays: Number(durationDays),
      propertyLimit: Number(propertyLimit),
      features: Array.isArray(features) ? features : [],
      active: true
    });

    return res.status(201).json({
      success: true,
      message: 'Subscription plan created successfully',
      plan
    });

  } catch (error) {
    console.error('Create subscription plan error:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A subscription plan with this name already exists'
      });
    }

    if (error.name === 'ValidationError') {
      return sendError(res, 400, error.message);
    }

    return sendError(
      res,
      500,
      'Failed to create subscription plan'
    );
  }
};
