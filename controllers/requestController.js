// controllers/requestController.js

const mongoose = require("mongoose");

const Request = require("../models/requestModel");
const Hostel = require("../models/hostelModel");
const User = require("../models/userModel");
const Notification = require("../models/Notification");

// =====================================================
// SHARING TYPE HELPERS
// =====================================================

const sharingMap = {
  "2": "twoSharing",
  "3": "threeSharing",
  "4": "fourSharing",
  "5": "fiveSharing",
  "6": "sixSharing",

  twoSharing: "twoSharing",
  threeSharing: "threeSharing",
  fourSharing: "fourSharing",
  fiveSharing: "fiveSharing",
  sixSharing: "sixSharing"
};

const normalizeSharingType = (value) => {
  const input = String(value || "").trim();

  const numericMap = {
    twoSharing: "2",
    threeSharing: "3",
    fourSharing: "4",
    fiveSharing: "5",
    sixSharing: "6"
  };

  if (["2", "3", "4", "5", "6"].includes(input)) {
    return input;
  }

  return numericMap[input] || null;
};

const isValidId = (id) => mongoose.isValidObjectId(id);

const getIO = (req) => req.app.get("io") || global.io;

// =====================================================
// CREATE + EMIT NOTIFICATION
// Uses the same notification structure as adminChatController
// =====================================================

const createRequestNotification = async ({
  req,
  recipientId,
  recipientType,
  senderId,
  senderType,
  title,
  message,
  requestId,
  actionUrl
}) => {
  try {
    const notification = await Notification.create({
      recipientId,
      recipientType,
      senderId,
      senderType,
      title,
      message,
      type: "request",
      referenceId: requestId,
      referenceType: "Request",
      actionUrl,
      isRead: false
    });

    const io = getIO(req);

    if (io) {
      const room = `${recipientType}-${recipientId.toString()}`;

      io.to(room).emit(
        "notification:new",
        notification.toObject()
      );
    }

    return notification;
  } catch (error) {
    // The request itself should remain saved if notification creation fails.
    console.error("Request notification error:", error);
    return null;
  }
};

// =====================================================
// SEARCH USERS
// GET /api/requests/search-users?query=value
// =====================================================

exports.searchUsers = async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Query is required"
      });
    }

    const users = await User.find({
      $or: [
        { email: { $regex: query, $options: "i" } },
        { mobile: { $regex: query, $options: "i" } }
      ]
    })
      .select("name email mobile createdAt")
      .limit(20)
      .lean();

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error("Search users error:", error);

    return res.status(500).json({
      success: false,
      message: "Error searching users",
      error: error.message
    });
  }
};

// =====================================================
// SEND REQUEST
// USER → OWNER or OWNER → USER
// POST /api/requests/send
// =====================================================

exports.sendRequest = async (req, res) => {
  try {
    let {
      ownerId,
      userId,
      hostelId,
      senderType,
      sharingType,
      propertyType,
      requestType
    } = req.body;

    if (!["user", "owner"].includes(senderType)) {
      return res.status(400).json({
        success: false,
        message: "senderType must be user or owner"
      });
    }

    if (!userId || !hostelId) {
      return res.status(400).json({
        success: false,
        message: "userId and hostelId are required"
      });
    }

    if (!isValidId(userId) || !isValidId(hostelId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId or hostelId"
      });
    }

    const normalizedSharingType =
      normalizeSharingType(sharingType);

    if (!normalizedSharingType) {
      return res.status(400).json({
        success: false,
        message: `Invalid sharing type: ${sharingType}`
      });
    }

    const hostel = await Hostel.findById(hostelId);

    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: "Hostel/property not found"
      });
    }

    // For a user request, always use the actual property owner.
    if (senderType === "user") {
      ownerId = hostel.ownerId;
    }

    if (!ownerId || !isValidId(ownerId)) {
      return res.status(400).json({
        success: false,
        message: "Valid ownerId is required"
      });
    }

    if (
      hostel.ownerId &&
      hostel.ownerId.toString() !== ownerId.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: "The supplied owner does not own this property"
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Do not allow a user who has already joined another property
    // to send a new booking request.
    const alreadyJoined = await Request.findOne({
      userId,
      status: "accepted"
    });

    if (
      alreadyJoined &&
      alreadyJoined.hostelId.toString() !== hostelId.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: "User has already joined another property"
      });
    }

    // Prevent duplicate pending/accepted requests.
    const existingRequest = await Request.findOne({
      ownerId,
      userId,
      hostelId,
      status: { $in: ["pending", "accepted"] }
    });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message: `Request is already ${existingRequest.status}`,
        data: existingRequest
      });
    }

    const newRequest = new Request({
      ownerId,
      userId,
      hostelId,
      senderType,
      sharingType: normalizedSharingType,
      propertyType,
      requestType,
      status: "pending"
    });

    await newRequest.save();

    // Notify the person who needs to respond.
    if (senderType === "user") {
      await createRequestNotification({
        req,
        recipientId: ownerId,
        recipientType: "owner",
        senderId: userId,
        senderType: "user",
        title: "New Pending Booking Request",
        message: `${user.name || "A user"} sent a booking request for ${hostel.name || "your property"}. Status: Pending.`,
        requestId: newRequest._id,
        actionUrl: "/owner-requests"
      });
    } else {
      await createRequestNotification({
        req,
        recipientId: userId,
        recipientType: "user",
        senderId: ownerId,
        senderType: "owner",
        title: "New Pending Property Request",
        message: `The owner sent you a request for ${hostel.name || "a property"}. Status: Pending.`,
        requestId: newRequest._id,
        actionUrl: "/my-requests"
      });
    }

    return res.status(201).json({
      success: true,
      message: "Request sent successfully. Status: Pending",
      data: newRequest
    });
  } catch (error) {
    console.error("Send request error:", error);

    return res.status(500).json({
      success: false,
      message: "Error sending request",
      error: error.message
    });
  }
};

// =====================================================
// GET USER REQUESTS
// GET /api/requests/user/:userId
// Optional: /api/requests/user/:userId?status=pending
// =====================================================

exports.getUserRequests = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    if (!isValidId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId"
      });
    }

    const filter = { userId };

    if (status && ["pending", "accepted", "declined"].includes(status)) {
      filter.status = status;
    }

    const requests = await Request.find(filter)
      .populate("ownerId", "name email mobile")
      .populate("hostelId", "name area address images roomSharing vacancy")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: requests.length,
      pendingCount: requests.filter(
        (request) => request.status === "pending"
      ).length,
      data: requests
    });
  } catch (error) {
    console.error("Get user requests error:", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching user requests",
      error: error.message
    });
  }
};

// =====================================================
// GET OWNER REQUESTS
// GET /api/requests/owner/:ownerId
// Optional: /api/requests/owner/:ownerId?status=pending
// =====================================================

exports.getOwnerRequests = async (req, res) => {
  try {
    const { ownerId } = req.params;
    const { status } = req.query;

    if (!isValidId(ownerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ownerId"
      });
    }

    const filter = { ownerId };

    if (status && ["pending", "accepted", "declined"].includes(status)) {
      filter.status = status;
    }

    const requests = await Request.find(filter)
      .populate("userId", "name email mobile")
      .populate("hostelId", "name area address images roomSharing vacancy")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: requests.length,
      pendingCount: requests.filter(
        (request) => request.status === "pending"
      ).length,
      data: requests
    });
  } catch (error) {
    console.error("Get owner requests error:", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching owner requests",
      error: error.message
    });
  }
};

// =====================================================
// UPDATE REQUEST STATUS
// ACCEPT / DECLINE
// PUT /api/requests/:requestId/status
// =====================================================

exports.updateRequestStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;

    if (!isValidId(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid requestId"
      });
    }

    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be accepted or declined"
      });
    }

    const request = await Request.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    // Only pending requests can be processed.
    if (request.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `This request has already been ${request.status}`
      });
    }

    const [hostel, user] = await Promise.all([
      Hostel.findById(request.hostelId),
      User.findById(request.userId)
    ]);

    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: "Hostel/property not found"
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const normalizedSharingType =
      normalizeSharingType(request.sharingType);

    if (!normalizedSharingType) {
      return res.status(400).json({
        success: false,
        message: `Invalid sharing type: ${request.sharingType}`
      });
    }

    const vacancyKey = sharingMap[normalizedSharingType];

    // =================================================
    // ACCEPT REQUEST
    // =================================================

    if (status === "accepted") {
      const otherAcceptedRequest = await Request.findOne({
        userId: request.userId,
        status: "accepted",
        _id: { $ne: request._id }
      });

      if (otherAcceptedRequest) {
        return res.status(409).json({
          success: false,
          message: "User has already joined another property"
        });
      }

      if (
        !hostel.vacancy ||
        typeof hostel.vacancy[vacancyKey] === "undefined"
      ) {
        return res.status(400).json({
          success: false,
          message: `${vacancyKey} vacancy is not configured`
        });
      }

      if (Number(hostel.vacancy[vacancyKey]) <= 0) {
        return res.status(400).json({
          success: false,
          message: `${normalizedSharingType}-sharing rooms are full`
        });
      }

      // Reduce available vacancy.
      hostel.vacancy[vacancyKey] =
        Number(hostel.vacancy[vacancyKey]) - 1;

      // Add user to hostelUsers only once.
      hostel.hostelUsers = hostel.hostelUsers || [];

      const alreadyInHostel = hostel.hostelUsers.some(
        (id) => id.toString() === request.userId.toString()
      );

      if (!alreadyInHostel) {
        hostel.hostelUsers.push(request.userId);
      }

      // Get price for the selected sharing type.
      let sharingPrice = 0;

      if (hostel.roomSharing) {
        if (hostel.roomSharing[vacancyKey] !== undefined) {
          sharingPrice = hostel.roomSharing[vacancyKey];
        } else if (
          hostel.roomSharing[normalizedSharingType] !== undefined
        ) {
          sharingPrice = hostel.roomSharing[normalizedSharingType];
        }
      }

      if (
        request.sharingPrice !== undefined &&
        request.sharingPrice !== null
      ) {
        sharingPrice = request.sharingPrice;
      }

      user.joinedHostel = {
        hostelId: hostel._id,
        hostelName: hostel.name,
        ownerId: hostel.ownerId,
        sharingType: normalizedSharingType,
        sharingPrice,
        area: hostel.area || "",
        address: hostel.address || "",
        status: "accepted",
        joinedDate: new Date()
      };

      await hostel.save();
      await user.save();
    }

    // =================================================
    // SAVE REQUEST STATUS
    // =================================================

    request.status = status;
    await request.save();

    // =================================================
    // NOTIFY THE ORIGINAL SENDER
    // =================================================

    const hostelName = hostel.name || "your property";

    if (request.senderType === "user") {
      // User originally sent it, so notify the user of owner's response.
      await createRequestNotification({
        req,
        recipientId: request.userId,
        recipientType: "user",
        senderId: request.ownerId,
        senderType: "owner",
        title:
          status === "accepted"
            ? "Booking Request Accepted"
            : "Booking Request Declined",
        message:
          status === "accepted"
            ? `Your request for ${hostelName} has been accepted.`
            : `Your request for ${hostelName} has been declined.`,
        requestId: request._id,
        actionUrl: "/my-requests"
      });
    } else {
      // Owner originally sent it, so notify the owner of user's response.
      await createRequestNotification({
        req,
        recipientId: request.ownerId,
        recipientType: "owner",
        senderId: request.userId,
        senderType: "user",
        title:
          status === "accepted"
            ? "Property Request Accepted"
            : "Property Request Declined",
        message:
          status === "accepted"
            ? `The user accepted your request for ${hostelName}.`
            : `The user declined your request for ${hostelName}.`,
        requestId: request._id,
        actionUrl: "/owner-requests"
      });
    }

    return res.status(200).json({
      success: true,
      message: `Request ${status} successfully`,
      data: request
    });
  } catch (error) {
    console.error("Update request status error:", error);

    return res.status(500).json({
      success: false,
      message: "Error updating request status",
      error: error.message
    });
  }
};

// =====================================================
// GET JOINED HOSTEL
// GET /api/requests/joined-hostel/:userId
// =====================================================

exports.getJoinedHostel = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId"
      });
    }

    const request = await Request.findOne({
      userId,
      status: "accepted"
    })
      .populate("hostelId")
      .populate("ownerId", "name email mobile");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "User has not joined any hostel yet"
      });
    }

    if (!request.hostelId) {
      return res.status(404).json({
        success: false,
        message: "Hostel details not found"
      });
    }

    const hostel = request.hostelId;
    const owner = request.ownerId;

    return res.status(200).json({
      success: true,
      data: {
        hostel: {
          id: hostel._id,
          name: hostel.name,
          area: hostel.area,
          address: hostel.address,
          description: hostel.description,
          images: hostel.images,
          roomSharing: hostel.roomSharing,
          vacancy: hostel.vacancy
        },
        owner: owner
          ? {
              id: owner._id,
              name: owner.name,
              email: owner.email,
              mobile: owner.mobile
            }
          : null,
        sharingType: request.sharingType,
        status: request.status
      }
    });
  } catch (error) {
    console.error("Get joined hostel error:", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching joined hostel",
      error: error.message
    });
  }
};