
const mongoose = require('mongoose');
const Hostel = require('../models/hostelModel');
const Review = require('../models/reviewModel');

// --------------------------------------------------
// Common helpers
// --------------------------------------------------

const PUBLIC_HOSTEL_FILTER = {
  isPublished: true,
  subscriptionStatus: 'ACTIVE'
};

const sharingKeyMap = {
  2: 'twoSharing',
  3: 'threeSharing',
  4: 'fourSharing',
  5: 'fiveSharing',
  6: 'sixSharing'
};

function getAuthenticatedOwnerId(req) {
  const user = req.user;

  if (!user) return null;

  const role = String(user.role || user.userType || '').toLowerCase();

  if (role !== 'owner') return null;

  return user._id || user.id || null;
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mapSharingData(input = {}) {
  const output = {
    twoSharing: 0,
    threeSharing: 0,
    fourSharing: 0,
    fiveSharing: 0,
    sixSharing: 0
  };

  // Supports: [{ sharing: 2, price: 5000 }]
  if (Array.isArray(input)) {
    input.forEach(item => {
      const sharing = item.sharing ?? item.share;
      const mappedKey = sharingKeyMap[sharing];

      if (mappedKey) {
        output[mappedKey] = Number(item.price ?? item.vacancy) || 0;
      }
    });

    return output;
  }

  // Supports: { 2: 5000, 3: 4000 }
  if (input && typeof input === 'object') {
    for (const key of Object.keys(input)) {
      const mappedKey = sharingKeyMap[key];

      if (mappedKey) {
        output[mappedKey] = Number(input[key]) || 0;
      }
    }
  }

  return output;
}

function getPublicHostelQuery(extraQuery = {}) {
  return {
    ...PUBLIC_HOSTEL_FILTER,
    ...extraQuery
  };
}

function parseHostelBody(req) {
  let hostelData = req.body?.hostel;

  if (typeof hostelData === 'string') {
    hostelData = JSON.parse(hostelData);
  }

  if (!hostelData || typeof hostelData !== 'object' || Array.isArray(hostelData)) {
    throw new Error('Invalid hostel data');
  }

  return hostelData;
}

// --------------------------------------------------
// Get all published and active hostels
// --------------------------------------------------

exports.getAllHostels = async (req, res) => {
  try {
    const hostels = await Hostel.aggregate([
      {
        $match: PUBLIC_HOSTEL_FILTER
      },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'hostelId',
          as: 'reviews'
        }
      },
      {
        $addFields: {
          avgRating: {
            $cond: [
              { $gt: [{ $size: '$reviews' }, 0] },
              { $round: [{ $avg: '$reviews.rating' }, 1] },
              0
            ]
          },
          reviewCount: {
            $size: '$reviews'
          }
        }
      },
      {
        $project: {
          reviews: 0
        }
      }
    ]);

    return res.status(200).json({
      data: hostels
    });

  } catch (error) {
    console.error('Get all hostels error:', error);

    return res.status(500).json({
      message: 'Failed to fetch hostels',
      error: error.message
    });
  }
};

// --------------------------------------------------
// Get top-rated published hostels
// Supports optional lat, lng and radius query params
// --------------------------------------------------

exports.getTopRatedHostels = async (req, res) => {
  try {
    const {
      limit = 10,
      lat,
      lng,
      radius = 5000
    } = req.query;

    const parsedLimit = Math.min(
      Math.max(parseInt(limit, 10) || 10, 1),
      100
    );

    const hasLat = lat !== undefined;
    const hasLng = lng !== undefined;

    if (hasLat !== hasLng) {
      return res.status(400).json({
        message: 'Both lat and lng are required for nearby top-rated hostels'
      });
    }

    const ratingAgg = await Review.aggregate([
      {
        $group: {
          _id: '$hostelId',
          avgRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 }
        }
      },
      {
        $sort: {
          avgRating: -1
        }
      }
    ]);

    if (ratingAgg.length === 0) {
      return res.status(200).json({ data: [] });
    }

    const hostelIds = ratingAgg.map(item => item._id);

    let hostelQuery = getPublicHostelQuery({
      _id: { $in: hostelIds }
    });

    if (hasLat && hasLng) {
      const latitude = Number(lat);
      const longitude = Number(lng);
      const maxDistance = Number(radius);

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180 ||
        !Number.isFinite(maxDistance) ||
        maxDistance <= 0
      ) {
        return res.status(400).json({
          message: 'Invalid latitude, longitude or radius'
        });
      }

      hostelQuery = {
        ...hostelQuery,
        location: {
          $nearSphere: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            $maxDistance: maxDistance
          }
        }
      };
    }

    const hostels = await Hostel.find(hostelQuery).lean();

    const hostelMap = new Map(
      hostels.map(hostel => [String(hostel._id), hostel])
    );

    const result = ratingAgg
      .filter(rating => hostelMap.has(String(rating._id)))
      .map(rating => ({
        ...hostelMap.get(String(rating._id)),
        avgRating: Number(rating.avgRating.toFixed(1)),
        reviewCount: rating.reviewCount
      }))
      .slice(0, parsedLimit);

    return res.status(200).json({
      data: result
    });

  } catch (error) {
    console.error('Top-rated hostels error:', error);

    return res.status(500).json({
      message: error.message
    });
  }
};

// --------------------------------------------------
// Search hostels by area and optional type
// --------------------------------------------------

exports.getHostelsByArea = async (req, res) => {
  try {
    const { area, type } = req.query;

    if (!area) {
      return res.status(400).json({
        message: 'area query required'
      });
    }

    const query = getPublicHostelQuery({
      area: {
        $regex: escapeRegex(area),
        $options: 'i'
      }
    });

    if (type) {
      const normalizedType = String(type).toLowerCase();

      if (!['boys', 'girls', 'room'].includes(normalizedType)) {
        return res.status(400).json({
          message: 'Invalid property type'
        });
      }

      query.type = normalizedType;
    }

    const hostels = await Hostel.find(query);

    return res.status(200).json({
      data: hostels
    });

  } catch (error) {
    console.error('Search hostels by area error:', error);

    return res.status(500).json({
      message: error.message
    });
  }
};

// --------------------------------------------------
// Get single published hostel
// --------------------------------------------------

exports.getSingleHostel = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'Invalid hostel ID'
      });
    }

    const hostel = await Hostel.findOne(
      getPublicHostelQuery({ _id: id })
    ).populate('hostelUsers', 'name email phone mobile');

    if (!hostel) {
      return res.status(404).json({
        message: 'Hostel not found or not available'
      });
    }

    return res.status(200).json({
      data: hostel
    });

  } catch (error) {
    console.error('Get single hostel error:', error);

    return res.status(500).json({
      message: error.message
    });
  }
};

// --------------------------------------------------
// Add hostel / rental room
// Owner authentication is required
// New properties remain unpublished until payment succeeds
// --------------------------------------------------

exports.addHostel = async (req, res) => {
  try {
    const ownerId = getAuthenticatedOwnerId(req);

    if (!ownerId) {
      return res.status(403).json({
        message: 'Only authenticated owners can create properties'
      });
    }

    if (!isValidId(ownerId)) {
      return res.status(401).json({
        message: 'Invalid owner account'
      });
    }

    const hostelData = parseHostelBody(req);

    if (!hostelData.name || !hostelData.area) {
      return res.status(400).json({
        message: 'Name and area are required'
      });
    }

    if (!['boys', 'girls', 'room'].includes(hostelData.type)) {
      return res.status(400).json({
        message: 'Invalid property type'
      });
    }

    const hostelImages = [];
    const hostelVideos = [];
    const sharingMedia = {};

    // Process uploaded files from multer upload.any()
    (req.files || []).forEach(file => {
      const filePath = `/uploads/${file.filename}`;
      const field = file.fieldname;

      if (field === 'images') {
        hostelImages.push(filePath);
        return;
      }

      if (field === 'videos') {
        hostelVideos.push(filePath);
        return;
      }

      // Dynamic fields:
      // sharing_2_images, sharing_2_videos, etc.
      if (field.startsWith('sharing_')) {
        const parts = field.split('_');
        const sharingType = parts[1];
        const mediaType = parts[2];

        if (
          !sharingKeyMap[sharingType] ||
          !['images', 'videos'].includes(mediaType)
        ) {
          return;
        }

        if (!sharingMedia[sharingType]) {
          sharingMedia[sharingType] = {
            images: [],
            videos: []
          };
        }

        sharingMedia[sharingType][mediaType].push(filePath);
        return;
      }

      // Angular upload fields:
      // sharingImages, sharingVideos
      if (field === 'sharingImages' || field === 'sharingVideos') {
        const sharingType = String(hostelData.selectedShare || 2);

        if (!sharingKeyMap[sharingType]) {
          return;
        }

        if (!sharingMedia[sharingType]) {
          sharingMedia[sharingType] = {
            images: [],
            videos: []
          };
        }

        if (field === 'sharingImages') {
          sharingMedia[sharingType].images.push(filePath);
        } else {
          sharingMedia[sharingType].videos.push(filePath);
        }
      }
    });

    const isRentalRoom = hostelData.type === 'room';

    const hostel = new Hostel({
      name: hostelData.name,
      area: hostelData.area,
      address: hostelData.address || '',

      // Never trust ownerId from the request body.
      ownerId: ownerId,

      type: hostelData.type,

      // Rental room details
      roomType: isRentalRoom ? hostelData.roomType || '' : '',
      bedrooms: isRentalRoom ? Number(hostelData.bedrooms) || 0 : 0,
      bathrooms: isRentalRoom ? Number(hostelData.bathrooms) || 0 : 0,
      rent: isRentalRoom ? Number(hostelData.rent) || 0 : 0,
      deposit: isRentalRoom ? Number(hostelData.deposit) || 0 : 0,
      builtUpArea: isRentalRoom ? Number(hostelData.builtUpArea) || 0 : 0,
      floor: isRentalRoom ? Number(hostelData.floor) || 0 : 0,
      furnishing: isRentalRoom ? hostelData.furnishing || '' : '',
      preferredTenants: isRentalRoom
        ? hostelData.preferredTenants || ''
        : '',

      features:
        isRentalRoom && Array.isArray(hostelData.features)
          ? hostelData.features
          : [],

      // Hostel sharing details
      roomSharing: !isRentalRoom
        ? mapSharingData(hostelData.roomSharing)
        : undefined,

      vacancy: !isRentalRoom
        ? mapSharingData(hostelData.vacancy)
        : undefined,

      // Facilities
      services: Array.isArray(hostelData.services)
        ? hostelData.services
        : [],

      // Uploaded media
      images: hostelImages,
      videos: hostelVideos,
      sharingMedia,

      // Location
      location: hostelData.location || {
        type: 'Point',
        coordinates: [0, 0]
      },

      // Subscription workflow:
      // Owner must pay before this property becomes public.
      subscriptionStatus: 'PENDING_PAYMENT',
      isPublished: false,
      subscriptionId: null
    });

    const savedHostel = await hostel.save();

    return res.status(201).json({
      message: isRentalRoom
        ? 'Rental room created successfully. Please select a subscription plan to publish it.'
        : 'Hostel created successfully. Please select a subscription plan to publish it.',
      data: savedHostel
    });

  } catch (error) {
    console.error('Create property error:', error);

    return res.status(400).json({
      message: 'Failed to create property',
      error: error.message
    });
  }
};

// --------------------------------------------------
// Filter published hostels by type
// --------------------------------------------------

exports.filterByType = async (req, res) => {
  try {
    const { type } = req.query;

    if (!type) {
      return res.status(400).json({
        message: 'type query required'
      });
    }

    const normalizedType = String(type).toLowerCase();

    if (!['boys', 'girls', 'room'].includes(normalizedType)) {
      return res.status(400).json({
        message: 'Invalid property type'
      });
    }

    const hostels = await Hostel.find(
      getPublicHostelQuery({ type: normalizedType })
    );

    return res.status(200).json({
      data: hostels
    });

  } catch (error) {
    console.error('Filter hostels error:', error);

    return res.status(500).json({
      message: error.message
    });
  }
};

// --------------------------------------------------
// Search by area + optional type
// --------------------------------------------------

exports.searchByAreaAndType = async (req, res) => {
  try {
    const { area, type } = req.query;

    const query = getPublicHostelQuery();

    if (area) {
      query.area = {
        $regex: escapeRegex(area),
        $options: 'i'
      };
    }

    if (type) {
      const normalizedType = String(type).toLowerCase();

      if (!['boys', 'girls', 'room'].includes(normalizedType)) {
        return res.status(400).json({
          message: 'Invalid property type'
        });
      }

      query.type = normalizedType;
    }

    const hostels = await Hostel.find(query);

    return res.status(200).json({
      data: hostels
    });

  } catch (error) {
    console.error('Combined hostel search error:', error);

    return res.status(500).json({
      message: error.message
    });
  }
};

// --------------------------------------------------
// Nearby published hostels
// lat/lng are in query params
// --------------------------------------------------

exports.getNearbyHostels = async (req, res) => {
  try {
    const {
      lat,
      lng,
      radius = 5000
    } = req.query;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({
        message: 'lat and lng query required'
      });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);
    const maxDistance = Number(radius);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      !Number.isFinite(maxDistance) ||
      maxDistance <= 0
    ) {
      return res.status(400).json({
        message: 'Invalid latitude, longitude or radius'
      });
    }

    const hostels = await Hostel.find(
      getPublicHostelQuery({
        location: {
          $nearSphere: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            $maxDistance: maxDistance
          }
        }
      })
    );

    return res.status(200).json({
      data: hostels
    });

  } catch (error) {
    console.error('Nearby hostels error:', error);

    return res.status(500).json({
      message: error.message
    });
  }
};

// --------------------------------------------------
// Decrement vacancy when booking
// Only active and published properties can be booked
// --------------------------------------------------

exports.decrementVacancy = async (req, res) => {
  try {
    const { id } = req.params;
    const { sharingKey } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'Invalid hostel ID'
      });
    }

    const allowedSharingKeys = [
      'twoSharing',
      'threeSharing',
      'fourSharing',
      'fiveSharing',
      'sixSharing'
    ];

    if (!sharingKey || !allowedSharingKeys.includes(sharingKey)) {
      return res.status(400).json({
        message: 'Invalid sharingKey'
      });
    }

    const update = {};
    update[`vacancy.${sharingKey}`] = -1;

    const hostel = await Hostel.findOneAndUpdate(
      getPublicHostelQuery({
        _id: id,
        [`vacancy.${sharingKey}`]: { $gt: 0 }
      }),
      {
        $inc: update
      },
      {
        new: true
      }
    );

    if (!hostel) {
      return res.status(400).json({
        message: 'No vacancy available or hostel not found'
      });
    }

    return res.status(200).json({
      message: 'Vacancy updated',
      data: hostel
    });

  } catch (error) {
    console.error('Decrement vacancy error:', error);

    return res.status(500).json({
      message: error.message
    });
  }
};

// --------------------------------------------------
// Get hostel joined by a user
// Only returns a currently published hostel
// --------------------------------------------------

exports.getUserJoinedHostel = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || !isValidId(userId)) {
      return res.status(400).json({
        message: 'Valid userId required'
      });
    }

    const hostel = await Hostel.findOne(
      getPublicHostelQuery({
        hostelUsers: userId
      })
    )
      .populate('ownerId', 'name email mobile')
      .select('name area address images pricePerMonth ownerId');

    if (!hostel) {
      return res.status(404).json({
        message: 'User has not joined any available hostel'
      });
    }

    return res.status(200).json({
      message: 'User joined hostel found',
      data: hostel
    });

  } catch (error) {
    console.error('Get joined hostel error:', error);

    return res.status(500).json({
      message: error.message
    });
  }
};

// --------------------------------------------------
// Owner: Get all properties belonging to logged-in owner
// Includes pending, active, expired and suspended hostels
// --------------------------------------------------

exports.getHostelsByOwner = async (req, res) => {
  try {
    const authenticatedOwnerId = getAuthenticatedOwnerId(req);

    if (!authenticatedOwnerId) {
      return res.status(403).json({
        message: 'Owner authentication required'
      });
    }

    const { ownerId } = req.params;

    if (
      !isValidId(ownerId) ||
      String(authenticatedOwnerId) !== String(ownerId)
    ) {
      return res.status(403).json({
        message: 'You are not allowed to access these properties'
      });
    }

    const hostels = await Hostel.find({
      ownerId: authenticatedOwnerId
    }).sort({
      createdAt: -1
    });

    return res.status(200).json({
      data: hostels
    });

  } catch (error) {
    console.error('Get owner hostels error:', error);

    return res.status(500).json({
      message: error.message
    });
  }
};

// --------------------------------------------------
// Owner: Get each hostel with its users
// --------------------------------------------------

exports.getHostelsWithUsers = async (req, res) => {
  try {
    const authenticatedOwnerId = getAuthenticatedOwnerId(req);

    if (!authenticatedOwnerId) {
      return res.status(403).json({
        message: 'Owner authentication required'
      });
    }

    const { ownerId } = req.params;

    if (
      !isValidId(ownerId) ||
      String(authenticatedOwnerId) !== String(ownerId)
    ) {
      return res.status(403).json({
        message: 'You are not allowed to access these properties'
      });
    }

    const hostels = await Hostel.find({
      ownerId: authenticatedOwnerId
    })
      .populate('hostelUsers', 'name email phone mobile')
      .select(
        'name area address hostelUsers subscriptionStatus isPublished subscriptionId'
      )
      .sort({
        createdAt: -1
      });

    if (!hostels.length) {
      return res.status(200).json({
        message: 'No hostels found for this owner',
        hostels: []
      });
    }

    return res.status(200).json({
      message: 'Hostels with users fetched successfully',
      hostels
    });

  } catch (error) {
    console.error('Get hostels with users error:', error);

    return res.status(500).json({
      message: 'Error fetching hostels with users',
      error: error.message
    });
  }
};

// --------------------------------------------------
// Get single published hostel by hostelId
// Public endpoint
// --------------------------------------------------

exports.getHostelById = async (req, res) => {
  try {
    const { hostelId } = req.params;

    if (!isValidId(hostelId)) {
      return res.status(400).json({
        message: 'Invalid hostel ID'
      });
    }

    const hostel = await Hostel.findOne(
      getPublicHostelQuery({
        _id: hostelId
      })
    )
      .populate('ownerId', 'name email mobile')
      .populate('hostelUsers', 'name email mobile phone');

    if (!hostel) {
      return res.status(404).json({
        message: 'Hostel not found or not available'
      });
    }

    return res.status(200).json(hostel);

  } catch (error) {
    console.error('Get hostel by ID error:', error);

    return res.status(500).json({
      message: 'Error fetching hostel',
      error: error.message
    });
  }
};

// --------------------------------------------------
// Owner: Delete own hostel and its reviews
// Subscription payment history is retained
// --------------------------------------------------

exports.deleteHostel = async (req, res) => {
  try {
    const authenticatedOwnerId = getAuthenticatedOwnerId(req);

    if (!authenticatedOwnerId) {
      return res.status(403).json({
        message: 'Owner authentication required'
      });
    }

    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'Invalid hostel ID'
      });
    }

    const hostel = await Hostel.findOne({
      _id: id,
      ownerId: authenticatedOwnerId
    });

    if (!hostel) {
      return res.status(404).json({
        message: 'Hostel not found or you do not own this hostel'
      });
    }

    await Hostel.deleteOne({
      _id: id,
      ownerId: authenticatedOwnerId
    });

    await Review.deleteMany({
      hostelId: id
    });

    return res.status(200).json({
      message: 'Hostel and related reviews deleted successfully'
    });

  } catch (error) {
    console.error('Delete hostel error:', error);

    return res.status(500).json({
      message: error.message
    });
  }
};
