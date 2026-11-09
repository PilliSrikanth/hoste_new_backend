const mongoose = require('mongoose');

const subscriptionPaymentSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },

    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },

    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OwnerSubscription',
      default: null
    },

    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: true
    },

    orderId: {
      type: String,
      required: true,
      unique: true
    },

    paymentSessionId: {
      type: String,
      default: null
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    currency: {
      type: String,
      default: 'INR'
    },

    status: {
      type: String,
      enum: [
        'PENDING',
        'PROCESSING',
        'PAID',
        'FAILED',
        'CANCELLED',
        'REFUNDED'
      ],
      default: 'PENDING'
    },

    paymentMethod: {
      type: String,
      default: null
    },

    cashfreePaymentId: {
      type: String,
      default: null
    },

    paidAt: {
      type: Date,
      default: null
    },

    verifiedAt: {
      type: Date,
      default: null
    },

    rawResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  'SubscriptionPayment',
  subscriptionPaymentSchema
);