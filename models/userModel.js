const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, required: true, unique: true },
  mobile: { type: String, required: true, unique: true},
  password: { type: String, required: true },
    joinedHostel: {
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    hostelName: String,
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "Owner" },
    sharingType: String,
    sharingPrice: Number,
    joinedDate: { type: Date} 
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
