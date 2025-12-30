const mongoose = require('mongoose');

const hostelSchema = new mongoose.Schema({
  // 🔹 Basic hostel info
  name: { type: String, required: true },
  area: { type: String, required: true },
  address: { type: String },
  images: [String],       
  description: { type: String },
  distance: { type: Number },

  // 🔹 Owner info
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true },

  // 🔹 hostel type
  type: { type: String, enum: ['boys', 'girls', 'room']},

  // 🔹 Room sharing & facilities & pricing
  roomSharing: {
    twoSharing: { type: Number, default: 0 },
    threeSharing: { type: Number, default: 0 },
    fourSharing: { type: Number, default: 0 },
    fiveSharing: { type: Number, default: 0 },
    sixSharing: { type: Number, default: 0 },
  },

  vacancy: {
    twoSharing: { type: Number, default: 0 },
    threeSharing: { type: Number, default: 0 },
    fourSharing: { type: Number, default: 0 },
    fiveSharing: { type: Number, default: 0 },
    sixSharing: { type: Number, default: 0 },
  },
  sharingImages: {
  twoSharing: { type: String },
  threeSharing: { type: String },
  fourSharing: { type: String },
  fiveSharing: { type: String },
  sixSharing: { type: String }
},
sharingMedia: {
  type: Map,
  of: {
    images: [String],
    videos: [String]
  }
},
images: [String],
videos: [String],


  // 🔹 location as GeoJSON point (longitude, latitude)
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      default: [0,0]
    }
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

// create 2dsphere index for geo queries
hostelSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Hostel', hostelSchema);
