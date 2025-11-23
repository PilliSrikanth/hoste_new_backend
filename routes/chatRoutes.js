const express = require('express');
const { sendMessage, getMessagesWithDetails } = require('../controllers/chatController');
const router = express.Router();

router.post('/send', sendMessage);  // send message
router.get('/:userId/:ownerId/:hostelId', getMessagesWithDetails);  // get messages between 2 users

module.exports = router;
