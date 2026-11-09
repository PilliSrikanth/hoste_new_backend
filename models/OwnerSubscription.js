const mongoose = require('mongoose');

const ownerSubscriptionSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner',
    required: true,
    index: true
  },

  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
    unique: true
  },

  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },

  status: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
    default: 'ACTIVE'
  },

  startDate: Date,
  endDate: Date,

  lastPaymentOrderId: {
    type: String,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('OwnerSubscription', ownerSubscriptionSchema);