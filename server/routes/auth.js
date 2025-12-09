const express = require('express');
const passport = require('passport');
const FacebookStrategy = require("passport-facebook").Strategy;
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, verifyApiKey } = require('../middleware/auth');
const User = require('../models/User');  // uppercase 'User'
const upload = require('../middleware/upload');
const fs = require('fs').promises;
const path = require('path');

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID, // Replace with your Facebook App ID
      clientSecret: process.env.FACEBOOK_APP_SECRET, // Replace with your Facebook App Secret
      callbackURL: "https://wjvjbeigxp63pfy6343cfffnrq0uzckz.lambda-url.us-east-1.on.aws/auth/facebook/callback", // Must match the authorized URI in Facebook Developer
      profileFields: ["id", "email", "name"], // Requested fields from Facebook
    },
    (accessToken, refreshToken, profile, done) => {
      // Handle user authentication (e.g., save user to database)
      const user = {
        provider: "facebook",
        providerId: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
      };
      return done(null, user);
    }
  )
);

// Helper function to check if strategy exists
const strategyExists = (name) => {
  return passport._strategies[name] !== undefined;
};

if (strategyExists('google')) {
  router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
  }));
  
  router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    authController.googleCallback
  );
}
// Facebook Auth Routes
if (strategyExists('facebook')) {
  router.get('/facebook', passport.authenticate('facebook', {
    scope: ['email']
  }));

  router.get('/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    authController.facebookCallback
  );
}

// Apple Auth Routes
if (strategyExists('apple')) {
  router.get('/apple',
    passport.authenticate('apple')
  );

  router.post('/apple/callback',
    passport.authenticate('apple', { failureRedirect: '/login' }),
    authController.appleCallback
  );
}

// Microsoft Auth Routes
if (strategyExists('microsoft')) {
  router.get('/microsoft',
    passport.authenticate('microsoft', {
      scope: ['user.read', 'openid', 'profile', 'email']
    })
  );

  router.get('/microsoft/callback',
    passport.authenticate('microsoft', { failureRedirect: '/login' }),
    authController.microsoftCallback
  );
}

// Email/Password routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/set-password', authController.setPassword);

// Social Login routes
router.post('/social-login', authController.socialLogin);

// Face ID routes
router.post('/face-id/update', authenticateToken, authController.updateFaceId);

// Profile routes
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile/update', authenticateToken, authController.updateProfile);

// Add new routes
router.post('/change-password', authenticateToken, authController.changePassword);
router.post('/oauth/connect', authenticateToken, authController.connectOAuth);
router.post('/oauth/disconnect', authenticateToken, authController.disconnectOAuth);

router.post('/profile/avatar', 
  authenticateToken,
  upload.single('avatar'),authController.updateAvatar);

// Fallback route for unconfigured strategies
router.get('/:provider', (req, res) => {
  res.status(501).json({
    error: `${req.params.provider} authentication is not configured`
  });
});

router.post('/check-admin-permission', authenticateToken, authController.checkAdminPermission);
router.get('/default-platform/:email', verifyApiKey, authController.defaultPlatform);

module.exports = router;
