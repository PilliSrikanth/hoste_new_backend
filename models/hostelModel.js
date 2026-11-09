
const mongoose = require('mongoose');

const hostelSchema = new mongoose.Schema({
  // Basic details
  name: {
    type: String,
    required: true,
    trim: true
  },

  area: {
    type: String,
    required: true,
    trim: true
  },

  address: {
    type: String,
    default: ''
  },

  type: {
    type: String,
    enum: ['boys', 'girls', 'room'],
    required: true
  },

  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner',
    required: true
  },

  // Subscription and activation
  subscriptionStatus: {
    type: String,
    enum: [
      'PENDING_PAYMENT',
      'ACTIVE',
      'EXPIRED',
      'SUSPENDED'
    ],
    default: 'PENDING_PAYMENT'
  },

  isPublished: {
    type: Boolean,
    default: false
  },

  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OwnerSubscription',
    default: null
  },

  // Rental room details
  roomType: {
    type: String,
    default: ''
  },

  bedrooms: {
    type: Number,
    default: 0
  },

  bathrooms: {
    type: Number,
    default: 0
  },

  rent: {
    type: Number,
    default: 0
  },

  deposit: {
    type: Number,
    default: 0
  },

  builtUpArea: {
    type: Number,
    default: 0
  },

  floor: {
    type: Number,
    default: 0
  },

  furnishing: {
    type: String,
    default: ''
  },

  preferredTenants: {
    type: String,
    default: ''
  },

  features: {
    type: [String],
    default: []
  },

  // Hostel sharing prices
  roomSharing: {
    twoSharing: { type: Number, default: 0 },
    threeSharing: { type: Number, default: 0 },
    fourSharing: { type: Number, default: 0 },
    fiveSharing: { type: Number, default: 0 },
    sixSharing: { type: Number, default: 0 }
  },

  vacancy: {
    twoSharing: { type: Number, default: 0 },
    threeSharing: { type: Number, default: 0 },
    fourSharing: { type: Number, default: 0 },
    fiveSharing: { type: Number, default: 0 },
    sixSharing: { type: Number, default: 0 }
  },

  // Media
  images: {
    type: [String],
    default: []
  },

  videos: {
    type: [String],
    default: []
  },

  sharingMedia: {
    type: Map,
    of: {
      images: { type: [String], default: [] },
      videos: { type: [String], default: [] }
    },
    default: {}
  },

  // GeoJSON: [longitude, latitude]
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },

  services: {
    type: [String],
    default: []
  },

  description: {
    type: String,
    default: ''
  },

  distance: {
    type: Number,
    default: 0
  },

  hostelUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  createdAt: {
    type: Date,
    default: Date.now
  }

});

hostelSchema.index({ location: '2dsphere' });

hostelSchema.index({
  ownerId: 1,
  subscriptionStatus: 1
});

module.exports = mongoose.model('Hostel', hostelSchema);
