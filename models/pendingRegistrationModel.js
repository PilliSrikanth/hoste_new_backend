const mongoose = require("mongoose");

const pendingRegistrationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    emailOtp: {
      type: String,
      required: true
    },

    emailOtpExpire: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Automatically delete pending registrations after 15 minutes
pendingRegistrationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 900 }
);

module.exports = mongoose.model(
  "PendingRegistration",
  pendingRegistrationSchema
);