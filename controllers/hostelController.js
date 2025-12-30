const Hostel = require('../models/hostelModel');
const Review = require('../models/reviewModel');

// Get all hostels
exports.getAllHostels = async (req, res) => {
  try {
    const hostels = await Hostel.find();
    res.status(200).json({ data: hostels });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get top-rated hostels (global)
exports.getTopRatedHostels = async (req, res) => {
  try {
    const hostels = await Hostel.find({ rating: { $gte: 4.5 } }).sort({ rating: -1 });
    res.status(200).json({ data: hostels });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get hostels by area (search) with optional category/type filter
exports.getHostelsByArea = async (req, res) => {
  try {
    const { area, type } = req.query;

    if (!area) {
      return res.status(400).json({ message: 'area query required' });
    }

    // Build query object
    const query = {
      area: { $regex: new RegExp(area, 'i') } // case-insensitive search
    };

    // Add type filter if provided
    if (type) {
      query.type = type; // "girls" or "boys"
    }

    const hostels = await Hostel.find(query);
    res.status(200).json({ data: hostels });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get single hostel
exports.getSingleHostel = async (req, res) => {
  try {
    const { id } = req.params;
    const hostel = await Hostel.findById(id).populate('hostelUsers', 'name email phone');
    if (!hostel) return res.status(404).json({ message: 'Hostel not found' });
    res.status(200).json({ data: hostel });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.addHostel = async (req, res) => {
  try {
    const hostelData = JSON.parse(req.body.hostel);

    // -------------------------
    // STORAGE OBJECTS
    // -------------------------
    const hostelImages = [];
    const hostelVideos = [];
    const sharingMedia = {}; 
    // structure:
    // sharingMedia = {
    //   "1": { images: [], videos: [] },
    //   "2": { images: [], videos: [] }
    // }

    // -------------------------
    // FILE PROCESSING
    // -------------------------
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const filePath = `/uploads/${file.filename}`;

        // HOSTEL MEDIA
        if (file.fieldname === 'images') {
          hostelImages.push(filePath);
        } 
        else if (file.fieldname === 'videos') {
          hostelVideos.push(filePath);
        }

        // SHARING MEDIA
        else if (file.fieldname.startsWith('sharing_')) {
          const parts = file.fieldname.split('_');
          const sharingType = parts[1]; // 1,2,3
          const mediaType = parts[2];   // images or videos

          if (!sharingMedia[sharingType]) {
            sharingMedia[sharingType] = {
              images: [],
              videos: []
            };
          }

          sharingMedia[sharingType][mediaType].push(filePath);
        }
      });
    }

    // -------------------------
    // SAVE HOSTEL
    // -------------------------
    const hostel = new Hostel({
      ...hostelData,
      images: hostelImages,
      videos: hostelVideos,
      sharingMedia,
      roomSharing: hostelData.roomSharing || {},
      vacancy: hostelData.vacancy || {},
      location: hostelData.location || { type: 'Point', coordinates: [0, 0] }
    });

    const savedHostel = await hostel.save();

    res.status(201).json({
      message: 'Hostel created successfully',
      data: savedHostel
    });

  } catch (error) {
    console.error(error);
    res.status(400).json({
      message: 'Failed to create hostel',
      error: error.message
    });
  }
};


// filter by type (boys/girls/pg/room)
exports.filterByType = async (req, res) => {
  try {
    const { type } = req.query;
    if (!type) return res.status(400).json({ message: 'type query required' });

    const hostels = await Hostel.find({ type: type.toLowerCase() });
    res.status(200).json({ data: hostels });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Search by area + optional type combined
exports.searchByAreaAndType = async (req, res) => {
  try {
    const { area, type } = req.query;
    const q = {};
    if (area) q.area = { $regex: new RegExp(area, 'i') };
    if (type) q.type = type.toLowerCase();

    const hostels = await Hostel.find(q);
    res.status(200).json({ data: hostels });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Nearby hostels by lat/lng and radius (in meters)
exports.getNearbyHostels = async (req, res) => {
  try {
    const { lat, lng, radius = 5000 } = req.query; // default 5km
    if (!lat || !lng) return res.status(400).json({ message: 'lat and lng query required' });

    const coords = [parseFloat(lng), parseFloat(lat)];
    const hostels = await Hostel.find({
      location: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: coords
          },
          $maxDistance: parseInt(radius) // meters
        }
      }
    });

    res.status(200).json({ data: hostels });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Nearby top rated - near by + sort by rating desc + limit
exports.getTopRatedHostels = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // 1️⃣ Group reviews to calculate rating summary
    const ratingAgg = await Review.aggregate([
      {
        $group: {
          _id: "$hostelId",
          avgRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 }
        }
      },
      { $sort: { avgRating: -1 } },
      { $limit: parseInt(limit) }
    ]);

    if (ratingAgg.length === 0) {
      return res.status(200).json({ data: [] });
    }

    // 2️⃣ Get hostel details
    const hostelIds = ratingAgg.map(r => r._id);
    const hostels = await Hostel.find({ _id: { $in: hostelIds } }).lean();

    // 3️⃣ Merge rating + hostel details, keep order
    const result = ratingAgg.map(rating => {
      const hostel = hostels.find(h => h._id.toString() === rating._id.toString());
      return {
        ...hostel,
        avgRating: rating.avgRating,
        reviewCount: rating.reviewCount
      };
    });

    res.status(200).json({ data: result });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// update vacancy when booking (decrement)
exports.decrementVacancy = async (req, res) => {
  try {
    const { id } = req.params;
    const { sharingKey } = req.body; // e.g., 'twoSharing'
    if (!sharingKey) return res.status(400).json({ message: 'sharingKey required' });

    const update = {};
    update[`vacancy.${sharingKey}`] = -1;

    // atomic decrement only if > 0
    const hostel = await Hostel.findOneAndUpdate(
      { _id: id, [`vacancy.${sharingKey}`]: { $gt: 0 } },
      { $inc: update },
      { new: true }
    );

    if (!hostel) return res.status(400).json({ message: 'No vacancy or hostel not found' });

    res.status(200).json({ message: 'Vacancy updated', data: hostel });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// ✅ User Joined Hostel
exports.getUserJoinedHostel = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) return res.status(400).json({ message: "userId required" });

    // find hostel where this user is present
    const hostel = await Hostel.findOne({ hostelUsers: userId })
    .populate('ownerId', 'name email phone')  // show owner also
    .select('name area address images pricePerMonth ownerId');

    if (!hostel) {
      return res.status(404).json({ message: "User not joined any hostel" });
    }

    res.status(200).json({
      message: "User joined hostel found",
      data: hostel
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


//admin

exports.getHostelsByOwner = async (req, res) => {
   try {
     const { ownerId } = req.params;
     const hostels = await Hostel.find({ ownerId });
     res.status(200).json(hostels);
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

 exports.getHostelById = async (req, res) => {
  try {
    const hostel = await Hostel.findById(req.params.hostelId)
    .populate('hostelUsers', 'name email phone');
    if (!hostel) return res.status(404).json({ message: 'Hostel not found' });
    res.status(200).json(hostel);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching hostel', error: error.message });
  }
};


// 🗑️ Owner: Delete hostel (with related reviews)
exports.deleteHostel = async (req, res) => {
  try {
    const { id } = req.params;

    const hostel = await Hostel.findById(id);
    if (!hostel) {
      return res.status(404).json({ message: 'Hostel not found' });
    }

    // Delete hostel
    await Hostel.findByIdAndDelete(id);

    // Delete all reviews related to this hostel
    await Review.deleteMany({ hostelId: id });

    res.status(200).json({ message: 'Hostel and related reviews deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
