const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TeamsUser = require('../models/TeamsUser');
const ZoomUser = require('../models/ZoomUser');
const GmeetUser = require('../models/GmeetUser');
const Company = require('../models/Company');
const { sendEmail } = require('../utils/email');
const { sendResetEmail } = require('../utils/email');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const pool = require("../config/database");

const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const jwt_decode = require('jsonwebtoken');
const axios = require('axios');

const generateToken = (user) => {
  return jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

const handleAuthCallback = async (req, res) => {
  console.log("Social OAuth Callback");
  try {
    // Check if the user object is available after authentication
    if (!req.user) {
      console.error("No user found in request.");
      return res.redirect(`${process.env.CLIENT_URL}/auth/error`);
    }

    // Check if the user already exists in the database
    let user = await User.findByEmail(req.user.email);

    if (!user) {
      // New user: Save the user to the database
      console.log("New user detected. Creating user in the database...");
      user = await User.create({
        name: req.user.name || "Unknown User", // Use the name from Google or a placeholder
        email: req.user.email, // Use email from Google
        googleId: req.user.googleId || req.user.id, // Save the Google ID
        profilePicture: req.user.picture || null, // Use Google profile picture if available
      });

      console.log("User successfully created:", user);
    }
    if(user && user.status != 'enabled') {
      return res.status(403).json({
        error: 'Submitted for approval!',
        details: {
          status: user.status,
          registrationDate: user.created_at,
          message: 'Your account is currently pending approval. An email has been sent to our administrator for review. You will be notified once your account is approved.',
          supportEmail: 'Matt.francis@getherd.ai',
          estimatedTime: '24-48 hours'
        }
      });
    }
    // Generate a token (e.g., JWT) for the authenticated user
    const token = generateToken(user);

    // Redirect based on whether the user is new or existing
    if (!user.registration_completed) {
      // New user: Redirect to the client with token and isNewUser=true
      return res.redirect(
        `${process.env.CLIENT_URL}?` +
        `token=${token}&` +
        `isNewUser=true`
      );
    } else {
      // Existing user: Update login time and redirect to the client
      await User.updateLoginTime(user.id);
      return res.redirect(
        `${process.env.CLIENT_URL}?` +
        `token=${token}&` +
        `isNewUser=false`
      );
    }
  } catch (error) {
    // Log the error and redirect to an error page
    console.error("Auth callback error:", error);
    return res.redirect(`${process.env.CLIENT_URL}/auth/error`);
  }
};
  

exports.googleCallback = handleAuthCallback;
exports.facebookCallback = handleAuthCallback;
exports.appleCallback = handleAuthCallback;
exports.microsoftCallback = handleAuthCallback;

// Get user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const teamsUser = await TeamsUser.findByUserId(user.id);
    const zoomUser = await ZoomUser.findByUserId(user.id);
    const googleUser = await GmeetUser.findByUserId(user.id);
    const company_id = (await pool.query('SELECT id FROM company WHERE admin_id = $1', [user.id])).rows[0];
    // Remove sensitive information
    const { password_hash, reset_token, reset_token_expires, ...userProfile } = user;
    
    res.json({ ...userProfile, teamsUser, zoomUser, googleUser, company_id: company_id?.id });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
};



// Email/Password Registration
exports.register = async (req, res) => {
  try {
    const { name, password } = req.body;
    const email = req.body.email?.toLowerCase();
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      if(!existingUser.password_hash && existingUser.provider == 'email' && existingUser.invite_token)
      {
        
        const company = await Company.findByEmail(email);

        const status = company ? 'enabled' : 'disabled';
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update user with new password and clear invite token
        await pool.query(
          'UPDATE users SET password_hash = $1, invite_token = NULL, status = $2, name = $3 WHERE email = $4',
          [hashedPassword, status, name, email]
        );

        const {rows : newaccount} = await pool.query('SELECT * FROM users WHERE email = $1', [email]); 
        if (newaccount.length > 0 && !company) {
          await sendEmail({
            to: 'Matt.francis@getherd.ai',
            subject: 'New User Registration - Approval Required',
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>New User Registration</title>
                <style>
                  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                  .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                  .user-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
                  .approve-btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3); }
                  .approve-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4); }
                  .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                  .highlight { color: #667eea; font-weight: bold; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1 style="margin: 0; font-size: 28px;">🎉 New User Registration</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Approval Required</p>
                  </div>
                  
                  <div class="content">
                    <h2 style="color: #333; margin-bottom: 20px;">Hello Matt,</h2>
                    
                    <p>A new user has registered and requires your approval to access the platform.</p>
                    
                    <div class="user-info">
                      <h3 style="margin: 0 0 15px 0; color: #667eea;">👤 User Details</h3>
                      <p><strong>Name:</strong> <span class="highlight">${name}</span></p>
                      <p><strong>Email:</strong> <span class="highlight">${email}</span></p>
                      <p><strong>Registration Date:</strong> <span class="highlight">${new Date().toLocaleDateString()}</span></p>
                    </div>
                    
                    <p style="margin: 25px 0;">Please review the user's information and click the button below to approve their account.</p>
                    
                    <div style="text-align: center;">
                      <a href="${process.env.ADMIN_URL}/user-management?action_type=approve_new_user&user_id=${newaccount[0].id}" class="approve-btn">
                        ✅ Approve User Account
                      </a>
                    </div>
                    
                    <p style="margin: 25px 0; font-size: 14px; color: #666;">
                      <strong>Note:</strong> This link will take you directly to the user management page where you can approve the user's account.
                    </p>
                    
                    <div class="footer">
                      <p>This is an automated notification from the HerdAI platform.</p>
                      <p>If you have any questions, please contact the development team.</p>
                    </div>
                  </div>
                </div>
              </body>
              </html>
            `
          });
          return res.status(403).json({
            error: 'Submitted for approval!',
            details: {
              status: newaccount[0].status,
              registrationDate: newaccount[0].created_at,
              message: 'Your account is currently pending approval. An email has been sent to our administrator for review. You will be notified once your account is approved.',
              supportEmail: 'Matt.francis@getherd.ai',
              estimatedTime: '24-48 hours'
            }
          });
        }

        // Generate token
        const token = generateToken(newaccount[0]);

        // Remove sensitive data
        const { password_hash, reset_token, reset_token_expires, ...userData1 } = newaccount[0];

        res.status(201).json({
          token,
          isNewUser: true,
          user: userData1
        });
      }
      return res.status(400).json({ 
        error: 'Email already registered',
        details: {
          message: 'An account with this email address already exists.',
          suggestion: 'Try signing in instead, or use a different email address.',
          nextSteps: ['Click "Sign In" to log into your existing account', 'Or use a different email address for registration'],
          supportEmail: 'Matt.francis@getherd.ai'
        }
      });
    }

    // Create new user
    const user = await User.createWithPassword({
      name,
      email,
      password
    });

    if(user && user.status != 'enabled') {
      return res.status(403).json({
        error: 'Submitted for approval!',
        details: {
          status: user.status,
          registrationDate: user.created_at,
          message: 'Your account is currently pending approval. An email has been sent to our administrator for review. You will be notified once your account is approved.',
          supportEmail: 'Matt.francis@getherd.ai',
          estimatedTime: '24-48 hours'
        }
      });
    }

    // Generate token
    const token = generateToken(user);

    // Remove sensitive data
    const { password_hash, reset_token, reset_token_expires, ...userData } = user;

    res.status(201).json({
      token,
      isNewUser: true,
      user: userData
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

// Email/Password Login
exports.login = async (req, res) => {
  try {
    const { email, password, termsAccepted } = req.body;
    
    // First check if user exists
    const existingUser = await User.findByEmail(email?.toLowerCase());
    if (!existingUser) {
      return res.status(401).json({ 
        error: 'No account found',
        details: {
          message: 'No account found with this email address.',
          suggestion: 'Please check your email or create a new account.',
          nextSteps: ['Verify your email address is correct', 'Create a new account if you don\'t have one'],
          supportEmail: 'Matt.francis@getherd.ai',
          showSignUp: true
        }
      });
    }
    
    // Then verify password
    const user = await User.verifyPassword(email?.toLowerCase(), password);
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        details: {
          message: 'The password you entered is incorrect.',
          suggestion: 'Please check your password and try again.',
          nextSteps: ['Check that your password is entered correctly', 'Try the "Forgot Password" option if needed'],
          supportEmail: 'Matt.francis@getherd.ai'
        }
      });
    }

    if (!termsAccepted && !user.agreed_date) {
      console.log("You must accept terms and conditions")
      return res.status(401).json({ 
        error: 'You must accept terms and conditions',
        details: {
          message: 'You must accept the terms and conditions to continue.',
          suggestion: 'Please check the terms and conditions checkbox before proceeding.',
          nextSteps: ['Check the "I accept the terms and conditions" checkbox', 'Review the terms and conditions if needed'],
          required: true
        }
      });
    }


    if (user.status !== 'enabled') {
      return res.status(403).json({
        error: 'Submitted for approval!',
        details: {
          status: user.status,
          registrationDate: user.created_at,
          message: 'Your account is currently pending approval. An email has been sent to our administrator for review. You will be notified once your account is approved.',
          supportEmail: 'Matt.francis@getherd.ai',
          estimatedTime: '24-48 hours'
        }
      });
    }

    await User.updateLoginTime(user.id);
    const token = generateToken(user);

    // Remove sensitive data
    const { password_hash, reset_token, reset_token_expires, ...userData } = user;

    res.json({
      token,
      isNewUser: false,
      user: userData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

// Password Reset Request
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const result = await User.createPasswordReset(email?.toLowerCase());
    if (result) {
      await sendResetEmail(result.user.email, result.resetToken);
      res.json({ message: 'Password reset email sent' });
    } else {
      res.status(404).json({ 
        error: 'Email not found',
        details: {
          message: 'No account was found with this email address.',
          suggestion: 'Please check the email address or create a new account.',
          nextSteps: ['Verify the email address is correct', 'Check for typos in the email', 'Create a new account if you don\'t have one'],
          supportEmail: 'Matt.francis@getherd.ai'
        }
      });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to process password reset',
      details: {
        message: 'We encountered an error while processing your password reset request.',
        suggestion: 'Please try again in a few minutes.',
        nextSteps: ['Wait a few minutes and try again', 'Contact support if the problem persists'],
        supportEmail: 'Matt.francis@getherd.ai'
      }
    });
  }
};

// Password Reset
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const user = await User.resetPassword(token, newPassword);
    
    if (!user) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset token',
        details: {
          message: 'The password reset link is invalid or has expired.',
          suggestion: 'Please request a new password reset link.',
          nextSteps: ['Go back to the login page', 'Click "Forgot Password" to request a new link', 'Check your email for the most recent reset link'],
          supportEmail: 'Matt.francis@getherd.ai',
          note: 'Password reset links expire after 1 hour for security reasons.'
        }
      });
    }

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

// Social Login (Google & Apple)
exports.socialLogin = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      authorization_code,
      user_type,
      user_identifier
    } = req.body;

    // Validate required fields
    if (!authorization_code || !user_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: authorization_code, user_type'
      });
    }


    // Validate user_type
    if (!['google', 'apple'].includes(user_type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user_type. Must be "google" or "apple"'
      });
    }

    let verifiedEmail = null;
    let verifiedUser = null;

    console.log("authorization_code:", authorization_code);

    // Verify authorization code based on user_type
    if (user_type.toLowerCase() === 'google') {
      try {
        // The authorization_code from Flutter is actually the ID token, not access token
        // If it's an access token, we need to exchange it or verify differently

        // First, try to verify as ID token (JWT format)
        if (authorization_code.split('.').length === 3) {
          console.log("authorization_code is a JWT (ID token)");
        // It's a JWT (ID token) - verify it
          const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
          const ticket = await client.verifyIdToken({
            idToken: authorization_code,
            audience: process.env.GOOGLE_CLIENT_ID,
          });

          const payload = ticket.getPayload();
          verifiedEmail = payload.email;
          verifiedUser = {
            email: payload.email,
            name: payload.name,
            given_name: payload.given_name,
            family_name: payload.family_name,
            provider_id: payload.sub,
            email_verified: payload.email_verified
          };
        } else {
          // It's an access token - use it to get user info from Google API
          const response = await axios.get(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${authorization_code}`);

          if (response.status !== 200) {
            throw new Error('Failed to fetch user info from Google');
          }

          const userInfo = response.data;
          verifiedEmail = userInfo.email;
          verifiedUser = {
            email: userInfo.email,
            name: userInfo.name,
            given_name: userInfo.given_name,
            family_name: userInfo.family_name,
            provider_id: userInfo.id,
            email_verified: userInfo.verified_email
          };
        }

      } catch (error) {
        console.error('Google token verification failed:', error);
        return res.status(400).json({
          success: false,
          error: 'Invalid Google authorization code'
        });
      }
    } else if (user_type.toLowerCase() === 'apple') {
      try {
        // For Apple, the authorization_code is the identity token (JWT)
        // First decode without verification to get header info
        const decoded = jwt_decode.decode(authorization_code, { complete: true });

        if (!decoded) {
          throw new Error('Invalid Apple identity token');
        }

        // Get Apple's public keys to verify the token
        const appleKeysResponse = await axios.get('https://appleid.apple.com/auth/keys');
        const appleKeys = appleKeysResponse.data.keys;

        // Find the correct key using the key ID from the token header
        const keyId = decoded.header.kid;
        const signingKey = appleKeys.find(key => key.kid === keyId);

        if (!signingKey) {
          throw new Error('Apple signing key not found');
        }

        // Verify the token using the public key
        // Note: For production, you should implement proper JWT verification with the public key
        // For now, we'll do basic validation and decode the payload
        const payload = decoded.payload;

        console.log("payload:", payload);
        // Validate the token
        if (payload.iss !== 'https://appleid.apple.com') {
          throw new Error('Invalid Apple token issuer');
        }

        if (payload.aud !== process.env.APPLE_CLIENT_ID && payload.aud !== process.env.APPLE_CLIENT_MOBILE_ID) {
          throw new Error('Invalid Apple token audience');
        }

        // Check if token is expired
        if (payload.exp < Date.now() / 1000) {
          throw new Error('Apple token has expired');
        }

        verifiedEmail = payload.email;
        verifiedUser = {
          email: payload.email,
          provider_id: payload.sub,
          email_verified: payload.email_verified || true // Apple emails are verified by default
        };

      } catch (error) {
        console.error('Apple token verification failed:', error);
        return res.status(400).json({
          success: false,
          error: 'Invalid Apple identity token: ' + error.message
        });
      }
    }


    // Check if user already exists
    let user = await User.findByEmail(verifiedEmail);
    let isNewUser = false;

    if (!user) {
      // Create new user
      isNewUser = true;
      const fullName = `${first_name} ${last_name}`.trim();

      user = await User.create({
        name: verifiedUser.name || fullName,
        email: verifiedEmail,
        provider: user_type.toLowerCase(),
        provider_id: verifiedUser.provider_id
      });

      console.log('New social login user created:', user.id);
    } else {
      // Update existing user's login time
      await User.updateLoginTime(user.id);
      console.log('Existing user social login:', user.id);
    }

    // Generate JWT token
    const token = generateToken(user);

    // Remove sensitive information
    const { password_hash, reset_token, reset_token_expires, ...userData } = user;

    res.status(200).json({
      success: true,
      token,
      isNewUser,
      user: userData,
      message: isNewUser ? 'User registered successfully' : 'User logged in successfully'
    });

  } catch (error) {
    console.error('Social login error:', error);
    res.status(500).json({
      success: false,
      error: 'Social login failed',
      message: error.message
    });
  }
};

// Face ID
exports.updateFaceId = async (req, res) => {
  try {
    const { faceIdData, enabled } = req.body;
    const user = await User.updateFaceId(req.user.id, faceIdData, enabled);
    
    res.json({
      message: enabled ? 'Face ID enabled' : 'Face ID disabled',
      faceIdEnabled: user.face_id_enabled
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update Face ID settings' });
  }
};

// Add this for updating profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, phone, location, bio, use_zoom, use_teams } = req.body;
    const updatedUser = await User.updateProfile(req.user.id, {
      name,
      phone,
      email,
      location,
      bio,
      use_zoom, 
      use_teams,
    });

    const { password_hash, reset_token, reset_token_expires, ...userProfile } = updatedUser;
    res.json(userProfile);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// Add new controller methods
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.changePassword(req.user.id, oldPassword, newPassword);
    
    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

exports.connectOAuth = async (req, res) => {
  try {
    const { provider, providerId } = req.body;
    const user = await User.connectOAuth(req.user.id, provider, providerId);
    
    // Remove sensitive data
    const { password_hash, ...userData } = user;
    res.json(userData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.disconnectOAuth = async (req, res) => {
  try {
    const user = await User.disconnectOAuth(req.user.id);
    
    // Remove sensitive data
    const { password_hash, ...userData } = user;
    res.json(userData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}; 

exports.updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const user = await User.findById(req.user.id);
    
    // Delete old avatar if it exists
    if (user.avatar) {
      const oldAvatarPath = path.join(__dirname, '../public/avatars', user.avatar); 
      try {
        await fs.unlink(oldAvatarPath);
      } catch (error) {
        console.error('Error deleting old avatar:', error);
      }
    } 

    // Update user with new avatar filename
    const updatedUser = await User.updateAvatar(req.user.id, req.file.filename);

    const { password_hash, reset_token, reset_token_expires, ...userProfile } = updatedUser;
    
    // Send only one response with all the needed data
    res.json({
      success: true,
      ...userProfile,
      avatar: req.file.filename
    });
  } catch (error) { 
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Error uploading avatar' });
  }
};        

exports.setPassword = async (req, res) => {
  const { token, email, password } = req.body;
  try {
    // Verify token and email combination
    const user = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND invite_token = $2',
      [email, token]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired invitation link'
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user with new password and clear invite token
    await pool.query(
      'UPDATE users SET password_hash = $1, invite_token = NULL WHERE email = $2',
      [hashedPassword, email]
    );

    res.json({
      success: true,
      message: 'Password set successfully'
    });
  } catch (error) {
    console.error('Error setting password:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set password'
    });
  }
};        

exports.checkAdminPermission = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    };
    if (user.rows[0].role === 'cadmin' || user.rows[0].role === 'padmin') {
      return res.json({
        success: true,
        message: 'User has admin permission'
      });
    } else {
      return res.status(403).json({
        success: false,
        error: 'User does not have admin permission'
      });
    }
  } catch (error) {
    console.error('Error checking admin permission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check admin permission'
    });
  }
};

exports.getPlatform = async (email) => {
  const user = await User.findByEmail(email);
  const teamsUser = await TeamsUser.findByUserId(user.id);
  const googleUser = await GmeetUser.findByUserId(user.id);
  const zoomUser = await ZoomUser.findByUserId(user.id);
  if (teamsUser.teams_scheduling) {
    return 'teams';
  } else if (googleUser.google_scheduling) {
    return 'google';
  } else if (zoomUser.zoom_scheduling) {
    return 'zoom';
  } else {
    return 'no platform';
  }
};

exports.defaultPlatform = async (req, res) => {
  try {
    //check teams_scheduling, google_scheduling, zoom_scheduling
    const { email } = req.params;
    const user = await User.findByEmail(email);
    const teamsUser = await TeamsUser.findByUserId(user.id);
    const googleUser = await GmeetUser.findByUserId(user.id);
    const zoomUser = await ZoomUser.findByUserId(user.id);
    if (teamsUser && teamsUser.teams_scheduling) {
      return res.json({
        success: true,
        message: 'Default platform set successfully',
        platform: 'teams'
      });
    } else if (googleUser && googleUser.google_scheduling) {
      return res.json({
        success: true,
        platform: 'google'
      });
    } else if (zoomUser && zoomUser.zoom_scheduling) {
      return res.json({
        success: true,
        platform: 'zoom'
      });
    } else {
      return res.json({
        success: false,
        platform: 'no platform'
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Failed to get default platform' });
  }
};