const Owner = require("../models/ownerModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

// Owner Registration
exports.registerOwner = async (req, res) => {
  try {
    const { name, email, mobile, password, payuKey, payuSalt } = req.body;

    const existingOwner = await Owner.findOne({ email });
    if (existingOwner) {
      return res.status(400).json({ message: "Owner already exists" });
    }

    const newOwner = new Owner({
      name,
      email,
      mobile,
      password,
      payuKey: payuKey || process.env.PAYU_MERCHANT_KEY,
      payuSalt: payuSalt || process.env.PAYU_MERCHANT_SALT,
    });

    await newOwner.save();
    res.status(201).json({ message: "Owner registered successfully", owner: newOwner });
  } catch (error) {
    res.status(500).json({ message: "Error registering owner", error });
  }
};

// Owner Login
exports.loginOwner = async (req, res) => {
  try {
    const { email, password } = req.body;

    const owner = await Owner.findOne({ email });
    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    const isMatch = await bcrypt.compare(password, owner.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: owner._id, role: "owner" }, "secret123", { expiresIn: "1d" });
    res.status(200).json({ message: "Login successful", token, owner });
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error });
  }
};

// Verify Owner PayU Keys
exports.verifyPayU = async (req, res) => {
  try {
    const owner = await Owner.findById(req.params.id);
    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    res.status(200).json({
      merchantKey: owner.payuKey,
      merchantSalt: owner.payuSalt
    });
  } catch (error) {
    res.status(500).json({ message: "Error verifying PayU credentials", error });
  }
};
