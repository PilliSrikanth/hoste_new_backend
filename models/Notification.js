const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who will see the notification
  type: { type: String, required: true }, // 'request', 'chat', etc.
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  data: { type: Object }, // extra info, e.g., requestId, hostelId
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
