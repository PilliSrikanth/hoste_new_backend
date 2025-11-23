const Request = require("../models/requestModel");
const Hostel = require("../models/hostelModel");
const User = require("../models/userModel");
const Notification = require('../models/Notification')

// 🔍 Search users by email or mobile (admin)
exports.searchUsers = async (req, res) => {
  try {
    const query = (req.query.query || "").trim();
    if (!query) {
      return res.status(400).json({ message: "Query is required" });
    }

    const users = await User.find({
      $or: [
        { email: { $regex: query, $options: "i" } },
        { mobile: { $regex: query, $options: "i" } }
      ]
    }).select("name email mobile createdAt");

    res.status(200).json({ count: users.length, data: users });
  } catch (error) {
    res.status(500).json({ message: "Error searching users", error: error.message });
  }
};

// 📤 Send a request (owner → user OR user → owner)

exports.sendRequest = async (req, res) => {
  try {
    let { ownerId, userId, hostelId, senderType, sharingType } = req.body;

    if (!["owner", "user"].includes(senderType)) {
      return res.status(400).json({ message: "Invalid sender type" });
    }

    // If user sends request, fetch owner from hostel
    if (senderType === "user" && !ownerId) {
      const hostel = await Hostel.findById(hostelId);
      if (!hostel) return res.status(404).json({ message: "Hostel not found" });
      ownerId = hostel.ownerId;
    }

    // Check if user already joined another hostel
    const alreadyJoined = await Request.findOne({
      userId,
      status: "accepted"
    });

    if (alreadyJoined && alreadyJoined.hostelId.toString() !== hostelId) {
      return res.status(400).json({
        message: "User already joined another hostel! Cannot send request."
      });
    }

    // Block if already pending OR accepted for same hostel
    const existing = await Request.findOne({
      ownerId,
      userId,
      hostelId,
      status: { $in: ["pending", "accepted"] }
    });

    if (existing) {
      return res.status(400).json({
        message: `Request already ${existing.status} between this owner and user`
      });
    }

    // Create new request
    const newRequest = new Request({
      ownerId,
      userId,
      hostelId,
      senderType,
      sharingType
    });
    await newRequest.save();

    // Create notification for owner
    await Notification.create({
      userId: userId,
      type: 'request',
      message: `New hostel booking request from user ${userId}`,
      data: { requestId: newRequest._id, hostelId, ownerId, userId },
    });

    res.status(201).json({
      message: `${senderType} request sent successfully`,
      data: newRequest
    });
  } catch (error) {
    console.error("❌ Error sending request:", error);
    res.status(500).json({ message: "Error sending request", error: error.message });
  }
};


// 📥 Get requests for a user (only requests where the user is receiver or sender)
exports.getUserRequests = async (req, res) => {
  try {
    const { userId } = req.params;

    // Only requests where the user is the receiver
    const requests = await Request.find({ userId }) // userId is the receiver
      .populate("ownerId", "name email")           // populate sender info
      .populate("hostelId", "name area");         // populate hostel info

    res.status(200).json({ count: requests.length, data: requests });
  } catch (error) {
    res.status(500).json({ message: "Error fetching user requests", error: error.message });
  }
};


// 📥 Get requests for an owner (only requests sent to their hostels)
exports.getOwnerRequests = async (req, res) => {
  try {
    const { ownerId } = req.params;

    const requests = await Request.find({ ownerId })
      .populate("userId", "name email")
      .populate({
        path: "hostelId",
        select: "name area ownerId",
        populate: { path: "ownerId", select: "name email" }
      });

    res.status(200).json({ count: requests.length, data: requests });
  } catch (error) {
    res.status(500).json({ message: "Error fetching owner requests", error: error.message });
  }
};

// 📥 Update request status
exports.updateRequestStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body; // accepted / declined

    const request = await Request.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    const hostel = await Hostel.findById(request.hostelId);
    if (!hostel) return res.status(404).json({ message: "Hostel not found" });
    
    const user = await User.findById(request.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const sharingType = request.sharingType;

    // ✅ Accept request: reduce vacancy and add user to hostel
    if (status === "accepted") {
      if (!hostel.vacancy.hasOwnProperty(sharingType)) {
        return res.status(400).json({ message: "Invalid sharing type" });
      }

      if (hostel.vacancy[sharingType] <= 0) {
        return res.status(400).json({ message: `${sharingType} rooms are full` });
      }

      // Reduce available room count
      hostel.vacancy[sharingType] -= 1;
      hostel.hostelUsers = hostel.hostelUsers || [];
      hostel.hostelUsers.addToSet(request.userId);
      hostel.status
      await hostel.save();

      // ✅ Auto-detect sharing price from hostel model
      const sharingPrice =
        request.sharingPrice || hostel.roomSharing?.[sharingType] || 0;

      // ✅ Update user's hostel details
      user.joinedHostel = {
        hostelId: hostel._id,
        hostelName: hostel.name,
        ownerId: hostel.ownerId,
        sharingType,
        sharingPrice,
        area: hostel.area,
        address: hostel.address,
        status,
        joinedDate: new Date(),
      };

      await user.save();
    }

    // ✅ Decline: Restore vacancy if previously accepted
    if (request.status === "accepted" && status === "declined") {
      hostel.vacancy[request.sharingType] += 1;
      hostel.hostelUsers.pull(request.userId);
      await hostel.save();

      user.joinedHostel = {}; // remove hostel details
      await user.save();
    }

    // ✅ Update request status
    request.status = status;
    await request.save();

    res.status(200).json({
      message: `Request ${status} successfully`,
      data: request,
    });
  } catch (error) {
    console.error("Error updating request:", error);
    res.status(500).json({
      message: "Error updating request",
      error: error.message,
    });
  }
};

// Get joined hostel details for a user
exports.getJoinedHostel = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find accepted request for this user
    const request = await Request.findOne({
      userId,
      status: "accepted"
    }).populate("hostelId").populate("ownerId", "name email mobile");

    if (!request) {
      return res.status(404).json({ message: "User has not joined any hostel yet" });
    }

    const hostel = request.hostelId;
    const owner = request.ownerId;

    res.status(200).json({
      hostel: {
        id: hostel._id,
        name: hostel.name,
        area: hostel.area,
        description: hostel.description,
        images: hostel.images,
        roomSharing: hostel.roomSharing,
        vacancy: hostel.vacancy
      },
      owner: {
        id: owner._id,
        name: owner.name,
        email: owner.email,
        mobile: owner.mobile
      },
      sharingType: request.sharingType
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching joined hostel", error: error.message });
  }
};
