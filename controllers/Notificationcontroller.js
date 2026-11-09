
const mongoose = require('mongoose');
const Notification = require('../models/Notification');

function getIdentity(req) {
  const id = req.user?.id || req.user?._id;
  const role = String(
    req.user?.role || req.user?.userType || ''
  ).toLowerCase();

  if (!id || !mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid authenticated user');
    error.status = 401;
    throw error;
  }

  if (!['user', 'owner', 'admin'].includes(role)) {
    const error = new Error(
      'Authentication middleware must provide a valid account role'
    );
    error.status = 403;
    throw error;
  }

  return { recipientId: id, recipientType: role };
}

function sendError(res, error) {
  return res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Server error'
  });
}

// GET /api/notification
exports.getNotifications = async (req, res) => {
  try {
    const identity = getIdentity(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number(req.query.limit) || 20)
    );

    const filter = {
      recipientId: identity.recipientId,
      recipientType: identity.recipientType
    };

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Notification.countDocuments(filter),

      Notification.countDocuments({
        ...filter,
        isRead: false
      })
    ]);

    res.json({
      success: true,
      notifications,
      total,
      unreadCount,
      page,
      limit
    });
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/notification/unread-count
exports.getUnreadCount = async (req, res) => {
  try {
    const identity = getIdentity(req);

    const unreadCount = await Notification.countDocuments({
      ...identity,
      isRead: false
    });

    res.json({ success: true, unreadCount });
  } catch (error) {
    sendError(res, error);
  }
};

// PATCH /api/notification/:id/read
exports.markAsRead = async (req, res) => {
  try {
    const identity = getIdentity(req);

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        ...identity
      },
      {
        $set: { isRead: true, readAt: new Date() }
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      notification
    });
  } catch (error) {
    sendError(res, error);
  }
};

// PATCH /api/notification/read-all
exports.markAllAsRead = async (req, res) => {
  try {
    const identity = getIdentity(req);

    const result = await Notification.updateMany(
      { ...identity, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    sendError(res, error);
  }
};

// DELETE /api/notification/:id
exports.deleteNotification = async (req, res) => {
  try {
    const identity = getIdentity(req);

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
    }

    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      ...identity
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    sendError(res, error);
  }
};