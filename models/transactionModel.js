const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "Owner", required: true },
    txnId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    status: { type: String, default: "pending" }, // pending, success, failure
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Transaction", transactionSchema);
