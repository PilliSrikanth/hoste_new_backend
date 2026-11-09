const express = require("express");

const router = express.Router();

const {
  sendMessage,
  getConversation,
  getAdminConversations,
  markAsRead,
  getUnreadCount
} = require("../controllers/adminChatController");


// Send message
router.post(
  "/send",
  sendMessage
);


// Get conversation
router.get(
  "/conversation/:userId/:adminId",
  getConversation
);


// Admin conversation list
router.get(
  "/admin/:adminId",
  getAdminConversations
);


// Mark messages read
router.put(
  "/read",
  markAsRead
);


// Unread count
router.get(
  "/unread/:userId/:adminId/:readerType",
  getUnreadCount
);


module.exports = router;