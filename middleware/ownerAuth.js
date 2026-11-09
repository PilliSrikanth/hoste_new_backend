
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    // 1. Check Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token is required'
      });
    }

    // 2. Extract token
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token is missing'
      });
    }

    // 3. Verify JWT
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is missing in backend .env');

      return res.status(500).json({
        success: false,
        message: 'Server authentication configuration error'
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    console.log('OWNER JWT PAYLOAD:', {
      id: decoded.id,
      ownerId: decoded.ownerId,
      _id: decoded._id,
      role: decoded.role,
      userType: decoded.userType,
      user_type: decoded.user_type
    });

    // 4. Get owner ID
    const ownerId =
      decoded.ownerId ||
      decoded.id ||
      decoded._id ||
      decoded.userId;

    // 5. Get user role
    const role = String(
      decoded.role ||
      decoded.userType ||
      decoded.user_type ||
      decoded.userRole ||
      ''
    ).toLowerCase();

    // 6. Validate owner ID
    if (!ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Owner ID not found in authentication token'
      });
    }

    // 7. Validate owner role
    if (role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Owner authentication required',
        decodedRole: role || 'missing',
        ownerIdFound: true
      });
    }

    // 8. Attach authenticated owner
    req.owner = {
      ...decoded,
      _id: ownerId,
      id: ownerId,
      ownerId: ownerId,
      role: 'owner'
    };

    req.user = req.owner;

    // 9. Continue
    next();

  } catch (error) {
    console.error('Owner authentication error:', error.message);

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};
