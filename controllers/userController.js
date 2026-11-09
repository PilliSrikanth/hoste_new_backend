
const User = require("../models/userModel");
const Transaction = require("../models/transactionModel");
const PendingRegistration = require("../models/pendingRegistrationModel");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const {
  sendEmailOtp,
  sendPasswordResetEmail
} = require("../utils/emailService");

// ======================================================
// HELPERS
// ======================================================

const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
};

const generateOtp = () =>
  crypto.randomInt(100000, 1000000).toString();

const hashOtp = (otp) =>
  crypto.createHash("sha256").update(String(otp)).digest("hex");

const normalizeEmail = (email) =>
  String(email || "").trim().toLowerCase();

const normalizeMobile = (mobile) =>
  String(mobile || "").trim();

const getProfileImageUrl = (req, profileImage) => {
  if (!profileImage) return "";

  if (
    profileImage.startsWith("http://") ||
    profileImage.startsWith("https://")
  ) {
    return profileImage;
  }

  return `${req.protocol}://${req.get("host")}${profileImage}`;
};

const publicUser = (req, user) => ({
  _id: user._id,
  id: user._id,
  userId: user._id,
  name: user.name,
  email: user.email,
  mobile: user.mobile || "",
  address: user.address || "",
  profileImage: getProfileImageUrl(req, user.profileImage),
  emailVerified: Boolean(user.emailVerified)
});

const handleError = (res, error, message) => {
  console.error(message, error);

  if (error.code === 11000) {
    const duplicateField = Object.keys(error.keyPattern || {})[0];

    const messages = {
      email: "Email already registered",
      mobile: "Mobile number already registered"
    };

    return res.status(409).json({
      message: messages[duplicateField] ||
        "A record with these details already exists"
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      message: error.message
    });
  }

  return res.status(500).json({
    message,
    error: error.message
  });
};

const validateOptionalMobile = (mobile, res) => {
  if (!mobile) return true;

  if (!/^\d{10}$/.test(mobile)) {
    res.status(400).json({
      message: "Enter a valid 10-digit mobile number"
    });
    return false;
  }

  return true;
};

// ======================================================
// REGISTER USER — SEND REGISTRATION EMAIL OTP
// ======================================================

exports.registerUser = async (req, res) => {
  try {
    const { name, email, mobile, password, confirmPassword } = req.body;

    if (!name?.trim() || !email || !password || !confirmPassword) {
      return res.status(400).json({
        message: "Name, email, password and confirm password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match"
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedMobile = normalizeMobile(mobile);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Enter a valid email address"
      });
    }

    if (!validateOptionalMobile(normalizedMobile, res)) return;

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email already registered"
      });
    }

    // Check mobile only when supplied.
    if (normalizedMobile) {
      const existingMobile = await User.findOne({
        mobile: normalizedMobile
      });

      if (existingMobile) {
        return res.status(409).json({
          message: "Mobile number already registered"
        });
      }
    }

    await PendingRegistration.deleteMany({
      email: normalizedEmail
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpExpire = new Date(Date.now() + 5 * 60 * 1000);

    const pendingData = {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      emailOtp: hashOtp(otp),
      emailOtpExpire: otpExpire
    };

    // IMPORTANT: Do not store an empty mobile string.
    if (normalizedMobile) {
      pendingData.mobile = normalizedMobile;
    }

    await PendingRegistration.create(pendingData);

    // Only log OTP during local development.
    if (process.env.NODE_ENV !== "production") {
      console.log("Registration OTP generated for:", normalizedEmail);
    }

    await sendEmailOtp(normalizedEmail, otp, "register");

    return res.status(200).json({
      message: "OTP sent successfully to your email",
      email: normalizedEmail,
      otpRequired: true
    });
  } catch (error) {
    return handleError(res, error, "Error sending registration OTP");
  }
};

// ======================================================
// VERIFY REGISTRATION OTP — CREATE USER
// ======================================================

exports.verifyRegisterOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required"
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const pendingUser = await PendingRegistration.findOne({
      email: normalizedEmail
    });

    if (!pendingUser) {
      return res.status(400).json({
        message: "Registration session expired. Please register again."
      });
    }

    if (
      !pendingUser.emailOtpExpire ||
      new Date(pendingUser.emailOtpExpire).getTime() < Date.now()
    ) {
      await PendingRegistration.deleteOne({ _id: pendingUser._id });

      return res.status(400).json({
        message: "OTP expired. Please register again."
      });
    }

    if (hashOtp(otp) !== pendingUser.emailOtp) {
      return res.status(400).json({
        message: "Invalid OTP"
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      await PendingRegistration.deleteOne({ _id: pendingUser._id });

      return res.status(409).json({
        message: "Email already registered"
      });
    }

    // Read mobile from pending registration and omit it if blank.
    const normalizedMobile = normalizeMobile(pendingUser.mobile);

    if (!validateOptionalMobile(normalizedMobile, res)) return;

    if (normalizedMobile) {
      const existingMobile = await User.findOne({
        mobile: normalizedMobile
      });

      if (existingMobile) {
        return res.status(409).json({
          message: "Mobile number already registered"
        });
      }
    }

    const userData = {
      name: pendingUser.name,
      email: normalizedEmail,
      password: pendingUser.password,
      profileImage: "",
      address: "",
      emailVerified: true,
      emailOtp: null,
      emailOtpExpire: null
    };

    // Do not assign mobile: "" — it conflicts with a unique index.
    if (normalizedMobile) {
      userData.mobile = normalizedMobile;
    }

    const user = await User.create(userData);

    await PendingRegistration.deleteOne({
      _id: pendingUser._id
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      message: "Registration successful",
      token,
      user: publicUser(req, user)
    });
  } catch (error) {
    return handleError(res, error, "Error verifying registration OTP");
  }
};

// ======================================================
// RESEND REGISTRATION OTP
// ======================================================

exports.resendRegisterOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required"
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const pendingUser = await PendingRegistration.findOne({
      email: normalizedEmail
    });

    if (!pendingUser) {
      return res.status(404).json({
        message: "Registration session expired. Please register again."
      });
    }

    const otp = generateOtp();

    pendingUser.emailOtp = hashOtp(otp);
    pendingUser.emailOtpExpire = new Date(Date.now() + 5 * 60 * 1000);

    await pendingUser.save();
    await sendEmailOtp(normalizedEmail, otp, "register");

    return res.status(200).json({
      message: "New OTP sent successfully to your email",
      email: normalizedEmail,
      otpRequired: true
    });
  } catch (error) {
    return handleError(res, error, "Error resending registration OTP");
  }
};

// ======================================================
// LOGIN — EMAIL + PASSWORD, THEN SEND OTP
// ======================================================

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({
      email: normalizedEmail
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const otp = generateOtp();

    user.emailOtp = hashOtp(otp);
    user.emailOtpExpire = new Date(Date.now() + 5 * 60 * 1000);

    await user.save();
    await sendEmailOtp(normalizedEmail, otp, "login");

    return res.status(200).json({
      message: "OTP sent successfully to your email",
      email: normalizedEmail,
      otpRequired: true
    });
  } catch (error) {
    return handleError(res, error, "Error sending login OTP");
  }
};

// ======================================================
// VERIFY LOGIN OTP
// ======================================================

exports.verifyLoginOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required"
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({
      email: normalizedEmail
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (!user.emailOtp || !user.emailOtpExpire) {
      return res.status(400).json({
        message: "No OTP found. Please login again."
      });
    }

    if (new Date(user.emailOtpExpire).getTime() < Date.now()) {
      user.emailOtp = null;
      user.emailOtpExpire = null;
      await user.save();

      return res.status(400).json({
        message: "OTP expired. Please login again."
      });
    }

    if (hashOtp(otp) !== user.emailOtp) {
      return res.status(400).json({
        message: "Invalid OTP"
      });
    }

    user.emailOtp = null;
    user.emailOtpExpire = null;
    user.emailVerified = true;

    await user.save();

    const token = generateToken(user._id);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: publicUser(req, user)
    });
  } catch (error) {
    return handleError(res, error, "Error verifying login OTP");
  }
};

// ======================================================
// GET USER DETAILS + TRANSACTIONS + JOINED HOSTEL
// ======================================================

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -resetPasswordToken -resetPasswordExpire -emailOtp -emailOtpExpire"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const transactions = await Transaction.find({
      $or: [
        { userId: user._id },
        { user: user._id }
      ]
    })
      .populate("hostel", "name")
      .populate("owner", "name email")
      .sort({ createdAt: -1 });

    const userData = user.toObject();

    userData.profileImage = getProfileImageUrl(
      req,
      user.profileImage
    );

    let joinedHostel = null;

    if (
      user.joinedHostel &&
      user.joinedHostel.hostelName &&
      user.joinedHostel.hostelName.trim() !== ""
    ) {
      joinedHostel = {
        hostelName: user.joinedHostel.hostelName,
        sharingType: user.joinedHostel.sharingType || "",
        sharingPrice: user.joinedHostel.sharingPrice || 0
      };
    }

    return res.status(200).json({
      user: {
        ...userData,
        joinedHostel
      },
      joinedHostel,
      transactions,
      count: transactions.length
    });
  } catch (error) {
    return handleError(res, error, "Error getting user details");
  }
};

// ======================================================
// UPDATE USER DETAILS
// ======================================================

exports.updateUser = async (req, res) => {
  try {
    const { name, email, mobile, address } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (email !== undefined) {
      const normalizedEmail = normalizeEmail(email);

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({
          message: "Enter a valid email address"
        });
      }

      if (normalizedEmail !== user.email.toLowerCase()) {
        const emailExists = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: user._id }
        });

        if (emailExists) {
          return res.status(409).json({
            message: "Email already registered"
          });
        }

        user.email = normalizedEmail;
      }
    }

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({
          message: "Name cannot be empty"
        });
      }

      user.name = String(name).trim();
    }

    if (mobile !== undefined) {
      const normalizedMobile = normalizeMobile(mobile);

      if (!validateOptionalMobile(normalizedMobile, res)) return;

      if (normalizedMobile) {
        const mobileExists = await User.findOne({
          mobile: normalizedMobile,
          _id: { $ne: user._id }
        });

        if (mobileExists) {
          return res.status(409).json({
            message: "Mobile number already registered"
          });
        }

        user.mobile = normalizedMobile;
      } else {
        // Unset mobile instead of storing an empty string.
        user.mobile = undefined;
      }
    }

    if (address !== undefined) {
      user.address = address;
    }

    const updatedUser = await user.save();

    return res.status(200).json({
      message: "User details updated successfully",
      user: publicUser(req, updatedUser)
    });
  } catch (error) {
    return handleError(res, error, "Error updating user");
  }
};

// ======================================================
// UPLOAD / UPDATE PROFILE IMAGE
// ======================================================

exports.uploadProfileImage = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Please select an image"
      });
    }

    user.profileImage = `/uploads/users/${req.file.filename}`;

    await user.save();

    return res.status(200).json({
      message: "Profile image uploaded successfully",
      user: publicUser(req, user)
    });
  } catch (error) {
    return handleError(res, error, "Error uploading profile image");
  }
};

// ======================================================
// CHANGE PASSWORD
// ======================================================

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters"
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const isMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isMatch) {
      return res.status(400).json({
        message: "Current password is incorrect"
      });
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      user.password
    );

    if (samePassword) {
      return res.status(400).json({
        message: "New password must be different from current password"
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({
      message: "Password changed successfully"
    });
  } catch (error) {
    return handleError(res, error, "Error changing password");
  }
};

// ======================================================
// FORGOT PASSWORD — SEND RESET LINK
// ======================================================

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required"
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({
      email: normalizedEmail
    });

    // Use the same response whether the account exists or not.
    if (!user) {
      return res.status(200).json({
        message: "If this email is registered, a reset link has been sent"
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

    await user.save();

    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
      throw new Error("FRONTEND_URL is not configured");
    }

    const resetUrl =
      `${frontendUrl.replace(/\/$/, "")}/reset-password/${resetToken}`;

    await sendPasswordResetEmail(normalizedEmail, resetUrl);

    return res.status(200).json({
      message: "Password reset link sent to your email"
    });
  } catch (error) {
    return handleError(res, error, "Error processing forgot password");
  }
};

// ======================================================
// RESET PASSWORD
// ======================================================

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        message: "Reset token and new password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: "Reset token is invalid or expired"
      });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;

    await user.save();

    return res.status(200).json({
      message: "Password reset successfully"
    });
  } catch (error) {
    return handleError(res, error, "Error resetting password");
  }
};
