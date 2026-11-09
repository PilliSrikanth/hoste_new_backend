const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema({
ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // IMPORTANT
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hostel",
    required: true,
  },
  senderType: {
    type: String,
    enum: ["owner", "user"], // who sent the request
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined"],
    default: "pending",
  },
  sharingPrice: { type: Number, required: false },
sharingType: {
  type: String,
  enum: ["2", "3", "4", "5", "6"],
  required: true
},
  createdAt: {
    type: Date,
    default: Date.now,
  },
});


module.exports = mongoose.model("Request", requestSchema);
