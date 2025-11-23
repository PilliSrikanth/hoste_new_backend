const Call = require("../models/callModel");

// Create a call request
exports.createCall = async (req, res) => {
  try {
    const { callerId, receiverId } = req.body;
    const newCall = new Call({ callerId, receiverId });
    await newCall.save();

    res.status(201).json({ message: "Call initiated", data: newCall });
  } catch (error) {
    res.status(500).json({ message: "Error creating call", error });
  }
};

// Update call status (accept/decline/missed)
exports.updateCallStatus = async (req, res) => {
  try {
    const { callId } = req.params;
    const { status } = req.body;

    const call = await Call.findById(callId);
    if (!call) return res.status(404).json({ message: "Call not found" });

    call.status = status;
    await call.save();

    res.status(200).json({ message: `Call ${status}`, data: call });
  } catch (error) {
    res.status(500).json({ message: "Error updating call", error });
  }
};

// Get all calls for a user
exports.getUserCalls = async (req, res) => {
  try {
    const { userId } = req.params;
    const calls = await Call.find({ $or: [{ callerId: userId }, { receiverId: userId }] })
      .populate("callerId receiverId", "name email");
    res.status(200).json(calls);
  } catch (error) {
    res.status(500).json({ message: "Error fetching calls", error });
  }
};
