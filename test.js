/** 
 * const mongoose = require('mongoose');
 
 const hostelSchema = new mongoose.Schema({
   // 🔹 Basic hostel info
   name: { type: String, required: true },
   area: { type: String, required: true },
   address: { type: String },
   image: { type: String },
   rating: { type: Number, default: 0 },
   description: { type: String },
   distance: { type: Number }, // in km
 
   // 🔹 Owner info
   ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true },
   ownerName: { type: String },
   ownerEmail: { type: String },
   ownerPhone: { type: String },
 
   // 🔹 Room sharing & facilities
   roomSharing: {
     oneSharing: { type: Number, default: 0 },
     twoSharing: { type: Number, default: 0 },
     threeSharing: { type: Number, default: 0 },
     fourSharing: { type: Number, default: 0 },
     fiveSharing: { type: Number, default: 0 },
     sixSharing: { type: Number, default: 0 },
   },
     vacancy: {
     oneSharing: { type: Number, default: 5},
     twoSharing: { type: Number, default: 5 },
     threeSharing: { type: Number, default: 5 },
     fourSharing: { type: Number, default: 5 },
     fiveSharing: { type: Number, default: 5 },
     sixSharing: { type: Number, default: 5 },
   },
 
   // 🔹 List of users accepted into this hostel
   hostelUsers: [
     {
       type: mongoose.Schema.Types.ObjectId,
       ref: 'User',
     },
   ],
 
   createdAt: { type: Date, default: Date.now },
 });
 
 module.exports = mongoose.model('Hostel', hostelSchema);
 
*/

/**
 * const Hostel = require('../models/hostelModel');
 
 // 📍 Get all hostels (user)
 exports.getAllHostels = async (req, res) => {
   try {
     const hostels = await Hostel.find();
     res.status(200).json(hostels);
   } catch (error) {
     res.status(500).json({ message: error.message });
   }
 };
 
 // ⭐ Get top-rated hostels (user)
 exports.getTopRatedHostels = async (req, res) => {
   try {
     const hostels = await Hostel.find({ rating: { $gte: 4.5 } });
     res.status(200).json(hostels);
   } catch (error) {
     res.status(500).json({ message: error.message });
   }
 };
 
 // 📍 Get hostels by area (user search)
 exports.getHostelsByArea = async (req, res) => {
   try {
     const { area } = req.query;
     const hostels = await Hostel.find({
       area: { $regex: new RegExp(area, 'i') },
     });
     res.status(200).json(hostels);
   } catch (error) {
     res.status(500).json({ message: error.message });
   }
 };
 // 📌 Get Single Hostel (user)
 exports.getSingleHostel = async (req, res) => {
   try {
     const { id } = req.params;
     const hostel = await Hostel.findById(id);
 
     if (!hostel) {
       return res.status(404).json({ message: "Hostel not found" });
     }
 
     res.status(200).json(hostel);
   } catch (error) {
     res.status(500).json({ message: error.message });
   }
 };
 
 
 // ➕ Owner: Add a new hostel
 exports.addHostel = async (req, res) => {
   try {
     const {
       name,
       area,
       address,
       image,
       pricePerMonth,
       description,
       distance,
       ownerId,
       ownerName,
       ownerEmail,
       ownerPhone,
       roomSharing
     } = req.body;
 
     const hostel = new Hostel({
       name,
       area,
       address,
       image,
       pricePerMonth,
       description,
       distance,
       ownerId,
       ownerName,
       ownerEmail,
       ownerPhone,
       roomSharing,
     });
 
     const savedHostel = await hostel.save();
     res.status(201).json({ message: 'Hostel created successfully', hostel: savedHostel });
   } catch (error) {
     res.status(400).json({ message: error.message });
   }
 };
 
 // 🧑‍💼 Get hostels owned by a specific owner
 exports.getHostelsByOwner = async (req, res) => {
   try {
     const { ownerId } = req.params;
     const hostels = await Hostel.find({ ownerId });
     res.status(200).json(hostels);
   } catch (error) {
     res.status(500).json({ message: error.message });
   }
 };
 
 // 🗑️ Owner: Delete hostel
 exports.deleteHostel = async (req, res) => {
   try {
     const { id } = req.params;
     await Hostel.findByIdAndDelete(id);
     res.status(200).json({ message: 'Hostel deleted successfully' });
   } catch (error) {
     res.status(500).json({ message: error.message });
   }
 };
 
 // 👑 Owner: Get each hostel with its users
 exports.getHostelsWithUsers = async (req, res) => {
   try {
     const { ownerId } = req.params;
 
     // Find all hostels owned by this owner and populate their users
     const hostels = await Hostel.find({ ownerId })
       .populate('hostelUsers', 'name email phone') // populate basic user info
       .select('name area address hostelUsers'); // include only relevant fields
 
     if (!hostels || hostels.length === 0) {
       return res.status(404).json({ message: 'No hostels found for this owner' });
     }
 
     res.status(200).json({
       message: 'Hostels with users fetched successfully',
       hostels,
     });
   } catch (error) {
     res.status(500).json({
       message: 'Error fetching hostels with users',
       error: error.message,
     });
   }
 };
 
 */

 /**
  * const express = require('express');
  const router = express.Router();
  const hostelController = require('../controllers/hostelController');
  
  // User routes
  router.get('/all', hostelController.getAllHostels);
  router.get('/top-rated', hostelController.getTopRatedHostels);
  router.get('/search', hostelController.getHostelsByArea);
  router.get('/single/:id', hostelController.getSingleHostel);
  
  
  // Owner routes
  router.post('/create', hostelController.addHostel);
  router.get('/owner/:ownerId', hostelController.getHostelsByOwner);
  router.delete('/delete/:id', hostelController.deleteHostel);
  router.get('/owner/:ownerId/hostel-users', hostelController.getHostelsWithUsers);
  
  
  module.exports = router;
  
  */