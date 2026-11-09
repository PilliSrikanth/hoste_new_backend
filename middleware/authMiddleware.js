
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const User = require('../models/userModel');
const Owner = require('../models/ownerModel');

module.exports = async function authMiddleware(req, res, next) {
  try {
    // 1. Read the authorization token
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is required'
      });
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is missing'
      });
    }

    // 2. Check JWT configuration
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is missing');

      return res.status(500).json({
        success: false,
        message: 'Authentication configuration error'
      });
    }

    // 3. Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const accountId =
      decoded.id ||
      decoded._id ||
      decoded.userId;

    const tokenRole = String(
      decoded.role || decoded.userType || ''
    ).trim().toLowerCase();

    if (!accountId || !mongoose.isValidObjectId(accountId)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token'
      });
    }

    // 4. Find the account using the role stored in the token
    let account = null;
    let role = tokenRole;

    if (role === 'user') {
      account = await User.findById(accountId)
        .select('-password')
        .lean();
    } else if (role === 'owner') {
      account = await Owner.findById(accountId)
        .select('-password')
        .lean();
    } else if (role === 'admin') {
      // Add your actual Admin model lookup here if admins
      // are stored in a separate collection.
      return res.status(403).json({
        success: false,
        message: 'Admin authentication requires its own account lookup'
      });
    } else {
      // Legacy tokens may not contain a role.
      // Resolve the account by ID, but reject ambiguous IDs.
      const [userAccount, ownerAccount] = await Promise.all([
        User.findById(accountId).select('-password').lean(),
        Owner.findById(accountId).select('-password').lean()
      ]);

      if (userAccount && ownerAccount) {
        return res.status(401).json({
          success: false,
          message: 'Account role is missing or ambiguous. Please log in again.'
        });
      }

      if (userAccount) {
        account = userAccount;
        role = 'user';
      } else if (ownerAccount) {
        account = ownerAccount;
        role = 'owner';
      }
    }

    // 5. Ensure the account exists
    if (!account) {
      return res.status(401).json({
        success: false,
        message: 'Account not found. Please log in again.'
      });
    }

    // 6. Attach authenticated identity to the request
    req.user = {
      ...account,
      id: String(account._id),
      _id: account._id,
      role: role,
      userType: role
    };

    // 7. Continue to the controller
    return next();

  } catch (error) {
    if (
      error.name === 'TokenExpiredError' ||
      error.name === 'JsonWebTokenError' ||
      error.name === 'NotBeforeError'
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please log in again.'
      });
    }

    console.error('Authentication middleware error:', error);

    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};
