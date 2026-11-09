
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },

    recipientType: {
      type: String,
      enum: ['user', 'owner', 'admin'],
      required: true
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },

    senderType: {
      type: String,
      enum: ['user', 'owner', 'admin', 'system'],
      default: 'system'
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    message: {
      type: String,
      required: true,
      trim: true
    },

    type: {
      type: String,
      enum: [
        'booking',
        'request',
        'payment',
        'rent',
        'chat',
        'review',
        'owner_approval',
        'property',
        'subscription',
        'system'
      ],
      default: 'system'
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },

    referenceType: {
      type: String,
      default: null
    },

    actionUrl: {
      type: String,
      default: null
    },

    isRead: {
      type: Boolean,
      default: false
    },

    readAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

notificationSchema.index({
  recipientId: 1,
  recipientType: 1,
  createdAt: -1
});

module.exports = mongoose.model(
  'Notification',
  notificationSchema
);
