const Booking = require('../models/bookingModel');
const Hostel = require('../models/hostelModel');
const User = require('../models/userModel');

// 📩 Create Booking Request
exports.createBooking = async (req, res) => {
  try {
    const { userId, hostelId, sharingType, message } = req.body;

    if (!userId || !hostelId || !sharingType) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) return res.status(404).json({ message: 'Hostel not found' });

    const booking = new Booking({
      userId,
      hostelId,
      sharingType,
      message,
    });

    const savedBooking = await booking.save();
    res.status(201).json({
      message: 'Booking request sent successfully',
      booking: savedBooking,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📋 Get All Bookings for a User
exports.getUserBookings = async (req, res) => {
  try {
    const { userId } = req.params;
    const bookings = await Booking.find({ userId })
      .populate('hostelId', 'name area pricePerMonth image')
      .sort({ createdAt: -1 });

    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🧾 Admin / Owner view all requests
exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('userId', 'name email')
      .populate('hostelId', 'name area');
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
