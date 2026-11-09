// backend/models/SubscriptionPlan.js

const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  price: { type: Number, required: true, min: 0 },
  durationDays: { type: Number, default: 30 },
  propertyLimit: { type: Number, required: true },
  features: [{ type: String }],
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);