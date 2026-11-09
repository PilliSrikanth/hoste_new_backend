
const mongoose = require("mongoose");

const adminChatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    adminId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Owner",
  required: true,
  index: true
},

    senderType: {
      type: String,
      enum: ["user", "admin"],
      required: true
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },

    read: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

adminChatSchema.index({
  userId: 1,
  adminId: 1,
  createdAt: 1
});

module.exports = mongoose.model("AdminChat", adminChatSchema);
