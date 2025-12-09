const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const AppleStrategy = require('passport-apple');
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const User = require('../models/User');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Helper function to check if strategy is configured
const isStrategyConfigured = (credentials) => {
  return Object.values(credentials).every(value => value && value.length > 0);
};

// Google Strategy
if (isStrategyConfigured({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET
})) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findByEmail(profile.emails[0].value);
      
      if (!user) {
        // This is a new user signing up
        user = await User.create({
          name: profile.displayName,
          email: profile.emails[0].value,
          provider: 'google',
          provider_id: profile.id
        });
      } else {
        // This is a returning user, update their login time
        user = await User.updateLoginTime(user.id);
      }
      
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
} else {
  console.log('Google OAuth is not configured');
}

// Facebook Strategy
if (isStrategyConfigured({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET
})) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL,
    profileFields: ['id', 'displayName', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findByEmail(profile.emails[0].value);
      
      if (!user) {
        // This is a new user signing up
        user = await User.create({
          name: profile.displayName,
          email: profile.emails[0].value,
          provider: 'facebook',
          provider_id: profile.id
        });
      } else {
        // This is a returning user, update their login time
        user = await User.updateLoginTime(user.id);
      }
      
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
} else {
  console.log('Facebook OAuth is not configured');
}

// Apple Strategy
if (isStrategyConfigured({
  clientID: process.env.APPLE_CLIENT_ID,
  teamID: process.env.APPLE_TEAM_ID,
  keyID: process.env.APPLE_KEY_ID
})) {
  passport.use(new AppleStrategy({
    clientID: process.env.APPLE_CLIENT_ID,
    teamID: process.env.APPLE_TEAM_ID,
    keyID: process.env.APPLE_KEY_ID,
    privateKeyLocation: process.env.APPLE_PRIVATE_KEY,
    callbackURL: process.env.APPLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findByEmail(profile.email);
      
      if (!user) {
        user = await User.create({
          name: profile.name || 'Apple User',
          email: profile.email,
          provider: 'apple',
          provider_id: profile.id
        });
      }
      
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
} else {
  console.log('Apple OAuth is not configured');
}

// Microsoft Strategy
if (isStrategyConfigured({
  clientID: process.env.MICROSOFT_CLIENT_ID,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET
})) {
  passport.use(new MicrosoftStrategy({
    clientID: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    callbackURL: process.env.MICROSOFT_CALLBACK_URL,
    scope: ['user.read', 'openid', 'profile', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findByEmail(profile.emails[0].value);
      
      if (!user) {
        // This is a new user signing up
        user = await User.create({
          name: profile.displayName,
          email: profile.emails[0].value,
          provider: 'microsoft',
          provider_id: profile.id
        });
      } else {
        // This is a returning user, update their login time
        user = await User.updateLoginTime(user.id);
      }
      
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
} else {
  console.log('Microsoft OAuth is not configured');
}

module.exports = passport;
