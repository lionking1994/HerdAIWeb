const jwt = require('jsonwebtoken');
const User = require('../models/User');
const pool = require('../config/database');
 
// exports.authenticateToken = async (req, res, next) => {
 
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];
 
//   if (!token) {
//     return res.status(401).json({ error: 'Authentication required' });
//   }
 
//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const user = await User.findById(decoded.id);
//     req.user = { ...decoded, ...user,  role: user?.role || decoded.role || 'user'};
//     next();
//   } catch (error) {
//     return res.status(403).json({ error: 'Invalid or expired token' });
//   }
// };
 
exports.authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
 
  let decoded = null;
  let user = null;
 
  if (token) {
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await User.findById(decoded.id);
    } catch (error) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  }
 
  // Always attach req.user (may be partial for public requests)
  req.user = {
    ...(decoded || {}),
    ...(user ? user.toObject?.() || user : {}),
    id:
      decoded?.id ||
      decoded?.userId ||
      user?._id?.toString() ||
      req.headers['x-user-id'] ||
      req.query.userId ||
      req.body?.userId ||
      null,
    role: user?.role || decoded?.role || 'user',
  };
 
  next();
};
 
 
// Optional: Middleware to check if user has completed registration
exports.checkRegistrationComplete = (req, res, next) => {
  if (!req.user.registration_completed) {
    return res.status(403).json({
      error: 'Please complete registration first',
      isNewUser: true
    });
  }
  next();
};
 
/**
 * Middleware to check if user is an admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.isAdmin = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user || (user.role !== 'cadmin' && user.role !== 'padmin')) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
   
    next();
  } catch (error) {
    console.error('Error checking admin status:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
 
exports.verifyApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
 
  if (!apiKey || apiKey !== process.env.REST_API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
 
  next();
}
 
 
exports.isCompanyAdmin = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const companyId = req.params.companyId;
 
    // Get Company From Company table
 
    const userCompanyCheck = await pool.query(
      `SELECT * FROM company WHERE admin_id = $1 AND id = $2`,
      [userId, companyId]
    );
 
    next();
  } catch (error) {
    console.error('Error checking company admin status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
 
 