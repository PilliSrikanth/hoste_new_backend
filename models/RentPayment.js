const mongoose = require('mongoose');

const rentPaymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Owner',
      default: null,
      index: true
    },

    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      default: null
    },

    rentMonth: {
      type: String,
      required: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01
    },

    expectedPaymentAmount: {
      type: Number,
      required: true,
      min: 0.01
    },

    currency: {
      type: String,
      default: 'INR'
    },

    paymentMethod: {
      type: String,
      enum: ['UPI'],
      default: 'UPI'
    },

    paymentStatus: {
      type: String,
      enum: [
        'PENDING',
        'EXPIRED',
        'SUCCESS',
        'FAILED',
        'REVIEW_REQUIRED'
      ],
      default: 'PENDING',
      index: true
    },

    provider: {
      type: String,
      default: 'COSMIC_PAY'
    },

    providerToken: {
      type: String,
      default: null
    },

    utr: {
      type: String,
      default: null,
      unique: true,
      sparse: true
    },

    paidAt: {
      type: Date,
      default: null
    },

    webhookReceivedAt: {
      type: Date,
      default: null
    },

    lastWebhookPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },

    reconciliationNote: {
      type: String,
      default: ''
    },

    refund: {
      status: {
        type: String,
        enum: [
          'NOT_REQUESTED',
          'REQUESTED',
          'PROCESSING',
          'REFUNDED',
          'REJECTED'
        ],
        default: 'NOT_REQUESTED'
      },

      amount: {
        type: Number,
        default: 0
      },

      reason: {
        type: String,
        default: ''
      },

      refundUtr: {
        type: String,
        default: ''
      },

      requestedAt: {
        type: Date,
        default: null
      },

      completedAt: {
        type: Date,
        default: null
      },

      processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('RentPayment', rentPaymentSchema);