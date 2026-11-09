module.exports = function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const role = String(req.user.role || '').toLowerCase();

  if (role !== 'admin' && role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  next();
};