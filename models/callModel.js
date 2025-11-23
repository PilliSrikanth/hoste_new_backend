const mongoose = require("mongoose");

const callSchema = new mongoose.Schema({
  callerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: {
    type: String,
    enum: ["ringing", "accepted", "declined", "missed"],
    default: "ringing"
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Call", callSchema);
