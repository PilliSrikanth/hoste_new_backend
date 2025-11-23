const Message = require('../models/messageModel');
const User = require('../models/userModel');
const Admin = require('../models/ownerModel');
const Hostel = require('../models/hostelModel');
const Notification = require('../models/Notification')

// 📩 Send message
exports.sendMessage = async (req, res) => {
  try {
    const { ownerId, userId, hostelId, message, senderType } = req.body;

    if (!ownerId || !userId || !hostelId || !message || !senderType) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const newMessage = new Message({
      ownerId,
      userId,
      hostelId,
      message,
      senderType
    });

    await newMessage.save();

    // Create a notification for the recipient
    await Notification.create({
      userId: senderType === 'user' ? ownerId : userId, // notify the other party
      type: 'chat',
      message: `${message}`,
      data: { messageId: newMessage._id, hostelId, ownerId, userId },
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: error.message });
  }
};


exports.getMessagesWithDetails = async (req, res) => {
  try {
    const { userId, ownerId, hostelId } = req.params;

    const messages = await Message.find({
      ownerId,
      userId,
      hostelId
    }).sort({ createdAt: 1 });

    const user = await User.findById(userId).select('name email mobile');
    const owner = await Admin.findById(ownerId).select('name phone email');
    const hostel = await Hostel.findById(hostelId).select('name area')

    res.status(200).json({
      user,
      owner,
      hostel,
      messages
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
