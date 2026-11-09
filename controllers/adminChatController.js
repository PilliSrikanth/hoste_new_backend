
const mongoose = require('mongoose');

const AdminChat = require('../models/adminChatModel');
const User = require('../models/userModel');
const Owner = require('../models/ownerModel');
const Notification = require('../models/Notification');

// =====================================================
// HELPERS
// =====================================================

const isValidId = (id) =>
  Boolean(id) && mongoose.isValidObjectId(id);

const isValidChatType = (type) =>
  ['user', 'admin'].includes(type);

const getIO = (req) =>
  req.app.get('io') || global.io;

// =====================================================
// SEND MESSAGE + CREATE NOTIFICATION + BROADCAST
// POST /api/admin-chat/send
//
// senderType = "user"  -> user sends to owner
// senderType = "admin" -> owner sends to user
// =====================================================

exports.sendMessage = async (req, res) => {
  try {
    const { userId, adminId, senderType, message } = req.body;

    // Validate request
    if (!userId || !adminId || !senderType || message === undefined) {
      return res.status(400).json({
        success: false,
        message: 'userId, adminId, senderType and message are required'
      });
    }

    if (
      !isValidId(userId) ||
      !isValidId(adminId) ||
      !isValidChatType(senderType)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userId, adminId or senderType'
      });
    }

    if (typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message must be text'
      });
    }

    const cleanMessage = message.trim();

    if (!cleanMessage) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty'
      });
    }

    if (cleanMessage.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot exceed 2000 characters'
      });
    }

    // Find both chat participants
    const [user, owner] = await Promise.all([
      User.findById(userId).select('_id name email mobile'),
      Owner.findById(adminId).select('_id name email mobile')
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found in User collection'
      });
    }

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Owner not found in Owner collection'
      });
    }

    // 1. Save chat message
    const chat = await AdminChat.create({
      userId: user._id,
      adminId: owner._id,
      senderType,
      message: cleanMessage,
      read: false
    });

    // 2. Populate saved message
    const populatedMessage = await AdminChat.findById(chat._id)
      .populate('userId', 'name email mobile')
      .populate('adminId', 'name email mobile')
      .lean();

    // 3. Get Socket.IO
    const io = getIO(req);

    // 4. Create notification for the RECEIVER
    try {
      let notificationData;
      let recipientRoom;

      if (senderType === 'user') {
        // User -> Owner
        notificationData = {
          recipientId: owner._id,
          recipientType: 'owner',
          senderId: user._id,
          senderType: 'user',
          title: 'New message from a user',
          message: cleanMessage,
          type: 'chat',
          referenceId: chat._id,
          referenceType: 'AdminChat',
          actionUrl: '/owner-chat',
          isRead: false
        };

        recipientRoom = `owner-${owner._id.toString()}`;
      } else {
        // Owner -> User
        notificationData = {
          recipientId: user._id,
          recipientType: 'user',
          senderId: owner._id,
          senderType: 'owner',
          title: 'New message from your property owner',
          message: cleanMessage,
          type: 'chat',
          referenceId: chat._id,
          referenceType: 'AdminChat',
          actionUrl: '/myprofile',
          isRead: false
        };

        recipientRoom = `user-${user._id.toString()}`;
      }

      const notification = await Notification.create(notificationData);

      console.log('Chat notification created:', {
        notificationId: notification._id.toString(),
        recipientId: notificationData.recipientId.toString(),
        recipientType: notificationData.recipientType
      });

      // Real-time notification
      if (io) {
        io.to(recipientRoom).emit(
          'notification:new',
          notification.toObject()
        );
      }
    } catch (notificationError) {
      // Chat is already saved. Log notification failure separately.
      console.error(
        'Failed to create chat notification:',
        notificationError
      );
    }

    // 5. Broadcast chat message to both participants
    if (io) {
      const userRoom = `user-${user._id.toString()}`;
      const ownerRoom = `admin-${owner._id.toString()}`;

      io.to(userRoom)
        .to(ownerRoom)
        .emit('admin-chat:message', populatedMessage);
    } else {
      console.error('Socket.IO instance not found');
    }

    // 6. Return success
    return res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: populatedMessage
    });
  } catch (error) {
    console.error('Send chat message error:', error);

    return res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: error.message
    });
  }
};

// =====================================================
// GET CONVERSATION
// GET /api/admin-chat/conversation/:userId/:adminId
// =====================================================

exports.getConversation = async (req, res) => {
  try {
    const { userId, adminId } = req.params;

    if (!isValidId(userId) || !isValidId(adminId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userId or adminId'
      });
    }

    const messages = await AdminChat.find({ userId, adminId })
      .populate('userId', 'name email mobile')
      .populate('adminId', 'name email mobile')
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    console.error('Get conversation error:', error);

    return res.status(500).json({
      success: false,
      message: 'Error fetching conversation',
      error: error.message
    });
  }
};

// =====================================================
// GET OWNER CONVERSATIONS
// GET /api/admin-chat/admin/:adminId
// =====================================================

exports.getAdminConversations = async (req, res) => {
  try {
    const { adminId } = req.params;

    if (!isValidId(adminId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid adminId'
      });
    }

    const owner = await Owner.findById(adminId).select('_id');

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Owner not found'
      });
    }

    const messages = await AdminChat.find({ adminId })
      .populate('userId', 'name email mobile')
      .populate('adminId', 'name email mobile')
      .sort({ createdAt: -1 })
      .lean();

    const conversations = [];
    const seenUsers = new Set();

    for (const chat of messages) {
      if (!chat.userId) continue;

      const conversationUserId = chat.userId._id.toString();

      if (seenUsers.has(conversationUserId)) continue;

      seenUsers.add(conversationUserId);
      conversations.push(chat);
    }

    return res.status(200).json({
      success: true,
      count: conversations.length,
      data: conversations
    });
  } catch (error) {
    console.error('Get owner conversations error:', error);

    return res.status(500).json({
      success: false,
      message: 'Error fetching conversations',
      error: error.message
    });
  }
};

// =====================================================
// MARK MESSAGES AS READ
// PUT /api/admin-chat/read
// =====================================================

exports.markAsRead = async (req, res) => {
  try {
    const { userId, adminId, readerType } = req.body;

    if (
      !isValidId(userId) ||
      !isValidId(adminId) ||
      !isValidChatType(readerType)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid userId, adminId and readerType are required'
      });
    }

    const senderType = readerType === 'user' ? 'admin' : 'user';

    const result = await AdminChat.updateMany(
      {
        userId,
        adminId,
        senderType,
        read: false
      },
      { $set: { read: true } }
    );

    return res.status(200).json({
      success: true,
      message: 'Messages marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Mark messages as read error:', error);

    return res.status(500).json({
      success: false,
      message: 'Error marking messages as read',
      error: error.message
    });
  }
};

// =====================================================
// GET UNREAD CHAT COUNT
// GET /api/admin-chat/unread/:userId/:adminId/:readerType
// =====================================================

exports.getUnreadCount = async (req, res) => {
  try {
    const { userId, adminId, readerType } = req.params;

    if (
      !isValidId(userId) ||
      !isValidId(adminId) ||
      !isValidChatType(readerType)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userId, adminId or readerType'
      });
    }

    const senderType = readerType === 'user' ? 'admin' : 'user';

    const count = await AdminChat.countDocuments({
      userId,
      adminId,
      senderType,
      read: false
    });

    return res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Get unread count error:', error);

    return res.status(500).json({
      success: false,
      message: 'Error getting unread count',
      error: error.message
    });
  }
};
