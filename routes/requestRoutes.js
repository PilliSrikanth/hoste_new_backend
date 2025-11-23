const express = require("express");
const router = express.Router();
const {
  sendRequest,
  getUserRequests,
  getOwnerRequests,
  updateRequestStatus,
  searchUsers,
  getJoinedHostel
} = require("../controllers/requestController");

// Send request (either owner→user or user→owner)
router.post("/send", sendRequest);

// Get all requests for a user
router.get("/user/:userId", getUserRequests);

// Get all requests for an owner
router.get("/owner/:ownerId", getOwnerRequests);

// Update request status
router.put("/:requestId/status", updateRequestStatus);

//owner
router.get('/searchusers', searchUsers);

router.get('/hostel/:userId', getJoinedHostel)

module.exports = router;
