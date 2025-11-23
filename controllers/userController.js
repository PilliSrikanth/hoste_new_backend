const User = require('../models/userModel');
const Transaction = require('../models/transactionModel');
const Hostel = require('../models/hostelModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// 📝 Register
exports.registerUser = async (req, res) => {
  const { name, email, mobile, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      mobile,
      password: hashedPassword,
    });

    res.status(201).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      token: generateToken(user.id),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
};

// 🔑 Login
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user.id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        token: generateToken(user.id),
      });
    } else {
      res.status(400).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};

// 🧾 Get User Details + Hostel + Transactions
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Support both field styles: `userId` and `user`
    const transactions = await Transaction.find({
      $or: [
        { userId: user._id },
        { user: user._id }
      ]
    })
    .populate("hostel", "name")
    .populate("owner", "name email")
    .sort({ createdAt: -1 });

    res.status(200).json({
      user,
      joinedHostel: user.hostelDetails || null,
      transactions,
      count: transactions.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
