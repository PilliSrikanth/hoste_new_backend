
const Owner = require("../models/ownerModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Return owner data without sensitive fields
const getSafeOwner = (owner) => {
  const data = owner.toObject();
  delete data.password;
  delete data.payuKey;
  delete data.payuSalt;
  delete data.__v;
  return data;
};

// Owner Registration
exports.registerOwner = async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;

    if (!name || !email || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, mobile, and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingOwner = await Owner.findOne({
      email: normalizedEmail,
    });

    if (existingOwner) {
      return res.status(409).json({
        success: false,
        message: "Owner already exists",
      });
    }

    const owner = new Owner({
      name: name.trim(),
      email: normalizedEmail,
      mobile: mobile.trim(),
      password,
    });

    await owner.save();

    return res.status(201).json({
      success: true,
      message: "Owner registered successfully",
      owner: getSafeOwner(owner),
    });
  } catch (error) {
    console.error("Owner registration error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or mobile number already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error registering owner",
    });
  }
};

// Owner Login
exports.loginOwner = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error("JWT_SECRET is missing from backend .env");

      return res.status(500).json({
        success: false,
        message: "Authentication configuration error",
      });
    }

    const owner = await Owner.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!owner) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, owner.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const ownerId = owner._id.toString();

    const token = jwt.sign(
      {
        id: ownerId,
        ownerId,
        role: "owner",
      },
      jwtSecret,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      owner: getSafeOwner(owner),
    });
  } catch (error) {
    console.error("Owner login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Error logging in",
    });
  }
};
