const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/Notificationcontroller');

router.get('/:userId', notificationController.getNotifications);
router.put('/read/:notificationId', notificationController.markAsRead);
router.delete('/:notificationId', notificationController.deleteNotification);


module.exports = router;
