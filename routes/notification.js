
const express = require('express');
const router = express.Router();

const notificationController = require(
  '../controllers/notificationController'
);

// Change this import to match your existing project.
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', notificationController.getNotifications);
router.get(
  '/unread-count',
  notificationController.getUnreadCount
);

router.patch(
  '/read-all',
  notificationController.markAllAsRead
);

router.patch(
  '/:id/read',
  notificationController.markAsRead
);

router.delete(
  '/:id',
  notificationController.deleteNotification
);

module.exports = router;
