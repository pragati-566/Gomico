const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();

// Middleware
app.set('trust proxy', 1); // Trust Render load balancer to get real user IP
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const courseRoutes = require('./routes/course');
const eventRoutes = require('./routes/event');

// Basic root route for testing deployment
app.get('/health', (req, res) => {
  res.send('Server is running');
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/course', courseRoutes);
app.use('/api/event', eventRoutes);

// Admin Routes
app.get('/admin', (req, res) => {
  console.log('Hit /admin route');
  res.sendFile(path.join(__dirname, '../admin_dashboard.html'));
});

app.get('/admin/events', (req, res) => {
  console.log('Hit /admin/events route');
  res.sendFile(path.join(__dirname, '../admin_events.html'));
});

app.get('/admin/users', (req, res) => {
  console.log('Hit /admin/users route');
  res.sendFile(path.join(__dirname, '../admin_user.html'));
});

// Serve frontend HTML pages directly — do NOT catch .html or asset requests
// The wildcard only applies to bare routes (SPA navigation) that don't match
// a real file. Express.static already handles index.html, admin_*.html, etc.
app.get('*', (req, res, next) => {
  // Let requests for files with extensions (html, js, css, png, etc.) fall through
  // so express.static can serve them — don't send index.html for those.
  if (req.path.includes('.')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../index.html'));
});


// Safety checks for environment variables
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

if (process.env.TEST_MODE === 'true' && !process.env.FIXED_OTP) {
  console.warn('⚠️  WARNING: TEST_MODE is enabled but FIXED_OTP is not defined. Falling back to default (1234).');
}

console.log('🚀 Server boot started...');
console.log('⚙️ Environment variables loaded');

// Connect to MongoDB (non-blocking — server boots even if DB is unavailable)
if (mongoUri) {
  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000, // Fail fast instead of hanging
  })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.warn('⚠️  Server will continue running. Fixed OTP login will work, but database features (registration, dashboard) will be unavailable.');
  });
} else {
  console.warn('⚠️  MONGO_URI is not defined. Running without database — only fixed OTP login will work.');
}

console.log('🚀 Express initialized');

const PORT = process.env.PORT || 5000;

function startServer() {
  try {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Listening on PORT ${PORT}`);
      console.log(`✅ Server running on port ${PORT}`);
    });

    server.on('error', (err) => {
      console.error('❌ Server startup error:', err);
      if (err.code === 'EADDRINUSE') {
         console.error(`❌ Port ${PORT} is already in use.`);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Critical startup failure:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
