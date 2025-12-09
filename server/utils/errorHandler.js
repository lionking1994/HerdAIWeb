/**
 * Centralized error handling utility for the application
 */

// Log error details to console with additional context
const logError = (error, context) => {
  console.error(`Error ${context}:`, {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    ...(error.code && { code: error.code }),
    ...(error.constraint && { constraint: error.constraint })
  });
};

/**
 * Handle API errors consistently
 * @param {Object} res - Express response object
 * @param {Error} error - Error object
 * @param {string} defaultMessage - Default error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @returns {Object} Response with error message
 */
exports.handleError = (res, error, defaultMessage = 'An error occurred', statusCode = 500) => {
  console.error(`Error: ${defaultMessage}`, error);
  
  // Check if it's a Stripe error
  if (error.type && error.type.startsWith('Stripe')) {
    return res.status(statusCode).json({
      success: false,
      message: error.message || defaultMessage,
      code: error.code,
      type: error.type
    });
  }
  
  // Regular error
  return res.status(statusCode).json({
    success: false,
    message: error.message || defaultMessage
  });
};

/**
 * Create a custom error with additional properties
 * @param {string} message - Error message
 * @param {string} [code] - Error code
 * @param {number} [statusCode] - HTTP status code
 */
exports.createError = (message, code, statusCode = 500) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

/**
 * Async error handler wrapper for route handlers
 * @param {Function} fn - Async route handler function
 */
exports.asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    handleError(res, error, 'Unhandled error in async operation');
  });
};
