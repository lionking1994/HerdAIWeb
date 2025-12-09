const express = require('express');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
const { initializeDatabase, checkDatabase } = require('./config/db.init');
const pool = require('./config/database');
require('./config/passport');
require('dotenv').config();
const path = require('path');
const app = express();
const http = require('http');
const { initialSocketServer, getIO } = require('./utils/socket');
const { availableVoices, getAvailableVoices, fetchAvailableVoices } = require('./utils/available-voices');
const server = http.createServer(app);
const crmRoutes = require('./routes/crm');
 
// Add server timeout settings
server.timeout = 120000; // 120 seconds
server.keepAliveTimeout = 120000;
 
// Configure cors
app.use(cors());
 
// Handle Stripe webhook route separately
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
 
// Regular JSON parsing for all other routes
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    next();
  } else {
    express.json({ limit: '150mb' })(req, res, next);
  }
});
 
app.use(express.urlencoded({ limit: '150mb', extended: true }));
 
// Initialize socket server and make io available to the app
const io = initialSocketServer(server);
app.set('io', io);
app.use('/api/avatars', express.static(path.join(__dirname, 'public', 'avatars')));
app.use('/api/files', express.static(path.join(__dirname, 'public', 'files')));
app.use('/api/presentations', express.static(path.join(__dirname, 'public', 'presentations')));
app.use('/api/csv', express.static(path.join(__dirname, 'public', 'csv')));
app.use('/api/diagrams', express.static(path.join(__dirname, 'public', 'diagrams')));
// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));
 
 
app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false
}));
 
app.use(passport.initialize());
app.use(passport.session());
 
// Add logging middleware before routes
app.use((req, res, next) => {
  const start = Date.now();
 
  // Capture response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const timestamp = new Date().toISOString();
    const user_id = req.user?.id || null;
   
    // Skip logging for avatar requests
    if (req.url.startsWith('/api/avatars') || req.url.startsWith('/api/system-logs')) {
      return;
    }
   
    console.log(`✨ [${timestamp}] ${req.method} ${req.url} - Status: ${res.statusCode} - Duration: ${duration}ms`);
   
    try {
      let username = 'anonymous';
      if (user_id) {
        pool.query(
          'SELECT name FROM users WHERE id = $1',
          [user_id]
        ).then(result =>
        {
          if (result.rows.length > 0) {
            username = result.rows[0].name;
            pool.query(
              `INSERT INTO request_logs
            (username, method, url, status, duration, timestamp, message, content)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [username, req.method, req.url, res.statusCode, duration, timestamp, res?.statusMessage, res?.body]
            );
          }
        }
        )
       
      }
      else {
        pool.query(
          `INSERT INTO request_logs
        (username, method, url, status, duration, timestamp, message, content)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [username, req.method, req.url, res.statusCode, duration, timestamp, res?.statusMessage, res?.body]
        );
      }
    } catch (error) {
      console.error('Error saving request log:', error);
    }
  });
 
  next();
});
 
// Health check endpoint
app.get('/api/health', async (req, res) => {
  const dbStatus = await checkDatabase();
  res.json({
    status: 'ok',
    database: dbStatus ? 'connected' : 'disconnected',
    timestamp: new Date()
  });
});
 
app.get('/api/version', async (req, res) => {
  res.json({
    status: 'version',
    timestamp: new Date()
  });
});
 
// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/zoom', require('./routes/zoom'));
app.use('/api/gmeet', require('./routes/gmeet'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/outlook', require('./routes/outlook'))
app.use('/api/linkedin', require('./routes/linkedin')); // Add LinkedIn routes
app.use('/api/meeting', require('./routes/meeting'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/notification', require('./routes/notification'));
app.use('/api/emoji-reactions', require('./routes/emojiReactions'));
app.use('/api/users', require('./routes/users'));
app.use('/api/contactus', require('./routes/contactus'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/company', require('./routes/company'));
app.use('/api/company-strategy', require('./routes/company-strategy'));
app.use('/api/company-roles', require('./routes/company-roles'));
app.use('/api/system-settings', require('./routes/system-settings'));
app.use('/api/system-logs', require('./routes/system-logs'));
app.use('/api/search', require('./routes/search'));
app.use('/api/agent', require('./routes/agent'));
app.use('/api/codegen', require('./routes/codegen'));
app.use('/api/stripe', require('./routes/stripe'));
app.use('/api/products', require('./routes/products'));
app.use('/api/user-licenses', require('./routes/userLicenses')); // Add User Licenses routes
app.use('/api/subscription-check', require('./routes/subscription-check'));
app.use('/api/prompt', require('./routes/prompt'));
app.use('/api/template', require('./routes/template')); // Add Template routes
app.use('/api/config', require('./routes/config'));
app.use('/api/files', require('./routes/files'));
app.use('/api/upload', require('./routes/upload')); // Add new upload route
app.use('/api/research', require('./routes/research'));
app.use('/api/calendar', require('./routes/Calendar')); // Add Calendar routes
app.use('/api/documents', require('./routes/documents')); // Add document routes
app.use('/api/user-analytics', require('./routes/userAnalytics')); // Add User Analytics routes
app.use('/api/workflow', require('./routes/workflow'));
app.use('/api/initiative', require('./routes/initiative'));
app.use('/api/coresignal', require('./routes/coresignal')); // Add CoreSignal routes
 
app.use('/api/crm', crmRoutes); // Add CRM routes  
app.use("/api/proxy", require("./routes/proxy"));
app.use('/api/organizations', require('./routes/organizations'));
 
app.use('/api/lms', require('./routes/LmsRoutes')); // Add LMS routes
app.use('/api/videos', express.static(path.join(__dirname, 'public', 'videos')));
app.use('/api/documents', express.static(path.join(__dirname, 'public', 'documents')));

app.use('/api/psa', require('./routes/psa'));
 
 
app.use('/.well-known', (req, res) => {  // Add this route handler for Apple App Site Association file
  if (req.url !== '/apple-app-site-association') {
    return res.status(404).send('Not Found');
  }
  console.log('Apple App Site Association file requested');
  res.json({
    "webcredentials": {
      "apps": ["5CT73F5J26.app.getherdmobile.ai"]
    }
  });
});
 
const PORT = process.env.PORT || 5000;
 
// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize database
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      console.error('❌ Failed to initialize database. Exiting...');
      process.exit(1);
    }
 
    // Start server
    server.listen(PORT, () => {
      console.log(`
🚀 Server is running on port ${PORT}
📝 Environment: ${process.env.NODE_ENV}
🔗 API URL: http://localhost:${PORT}
🔍 Health check: http://localhost:${PORT}/health
      `);
 
 
    });
  } catch (error) {
    console.error('❌ Server startup error:', error);
    process.exit(1);
  }
};
 
startServer();
fetchAvailableVoices();
 
 
// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});
 
process.on('SIGINT', async () => {
  console.log('👋 SIGINT received. Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});