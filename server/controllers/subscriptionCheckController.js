const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Product = require('../models/Product');
const { handleError } = require('../utils/errorHandler');
const pool = require("../config/database");

/**
 * Check if user needs to subscribe
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.checkSubscriptionNeeded = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's meeting count
    const meetingCount = await User.getMeetingCount(userId);
    
    const subscriptionThresholdQuery = await pool.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'stripe_config'`
    );
    const subscriptionThreshold = JSON.parse(subscriptionThresholdQuery.rows[0].setting_value).maxMeetingCount;

    
    // Check if user has any active subscriptions
    const activeSubscriptions = await Subscription.findActiveByUserId(userId);
    const hasActiveSubscription = activeSubscriptions.length > 0;
    
    // Get available products
    const availableProducts = await Product.findAll(true);
    
    return res.status(200).json({
      success: true,
      meetingCount,
      subscriptionThreshold,
      subscriptionNeeded: meetingCount >= subscriptionThreshold && !hasActiveSubscription,
      hasActiveSubscription,
      activeSubscriptions,
      availableProducts
    });
  } catch (error) {
    return handleError(res, error, 'Failed to check subscription status');
  }
};

/**
 * Increment user's meeting count
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.incrementMeetingCount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Increment meeting count
    const user = await User.updateMeetingCount(userId);
    
    // Get updated meeting count
    const meetingCount = user.meeting_count || 0;
    
    // Get subscription threshold from system settings
    const subscriptionThreshold = 10; // Hardcoded for now, could be from system settings
    
    // Check if user has any active subscriptions
    const activeSubscriptions = await Subscription.findActiveByUserId(userId);
    const hasActiveSubscription = activeSubscriptions.length > 0;
    
    return res.status(200).json({
      success: true,
      meetingCount,
      subscriptionThreshold,
      subscriptionNeeded: meetingCount >= subscriptionThreshold && !hasActiveSubscription,
      hasActiveSubscription
    });
  } catch (error) {
    return handleError(res, error, 'Failed to increment meeting count');
  }
};

/**
 * Reset user's meeting count
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.resetMeetingCount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Reset meeting count
    await User.resetMeetingCount(userId);
    
    return res.status(200).json({
      success: true,
      message: 'Meeting count reset successfully',
      meetingCount: 0
    });
  } catch (error) {
    return handleError(res, error, 'Failed to reset meeting count');
  }
};
