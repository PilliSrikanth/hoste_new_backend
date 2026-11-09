
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // BASIC USER DETAILS
    name: {
      type: String,
      trim: true
    },
    role: {
  type: String,
  enum: ['user'],
  default: 'user'
},

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    // Mobile is optional. Omit it when not provided.
    mobile: {
  type: String,
  trim: true
},

    password: {
      type: String,
      required: true
    },

    profileImage: {
      type: String,
      default: ''
    },

    address: {
      type: String,
      default: ''
    },

    // EMAIL OTP
    emailOtp: {
      type: String,
      default: null
    },

    emailOtpExpire: {
      type: Date,
      default: null
    },

    emailVerified: {
      type: Boolean,
      default: false
    },

    // PASSWORD RESET
    resetPasswordToken: {
      type: String,
      default: null
    },

    resetPasswordExpire: {
      type: Date,
      default: null
    },

    // JOINED HOSTEL
    joinedHostel: {
      hostelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hostel'
      },

      hostelName: {
        type: String,
        default: ''
      },

      ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Owner'
      },

      sharingType: {
        type: String,
        default: ''
      },

      sharingPrice: {
        type: Number,
        default: 0
      },

      joinedDate: {
        type: Date
      }
    }
  },
  {
    timestamps: true
  }
);

// Only non-empty mobile strings must be unique.
// Multiple users may omit the mobile field.
userSchema.index(
  { mobile: 1 },
  {
    unique: true,
    partialFilterExpression: {
      mobile: { $type: 'string', $gt: '' }
    }
  }
);

module.exports = mongoose.model('User', userSchema);
