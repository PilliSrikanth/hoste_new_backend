const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "Owner" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
  message: String,
  senderType: { type: String, enum: ['user','owner'], required:true }
}, {timestamps:true})

module.exports = mongoose.model("Message", messageSchema);
