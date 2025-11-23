const express = require('express');
const { createBooking, getUserBookings, getAllBookings } = require('../controllers/bookingController');
const router = express.Router();

router.post('/add', createBooking);          // send booking request
router.get('/user/:userId', getUserBookings); // user bookings
router.get('/all', getAllBookings);           // admin/owner view

module.exports = router;
