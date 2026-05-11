const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
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
if (!mongoUri) {
  console.error('❌ FATAL ERROR: MONGO_URI is not defined in environment variables.');
  process.exit(1);
}

if (process.env.TEST_MODE === 'true' && !process.env.FIXED_OTP) {
  console.warn('⚠️  WARNING: TEST_MODE is enabled but FIXED_OTP is not defined. Falling back to default (1234).');
}

// Connect to MongoDB
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

const PORT = parseInt(process.env.PORT, 10) || 3000;
const MAX_ATTEMPTS = 10;

function startServer(port, attempts = 0) {
  if (attempts >= MAX_ATTEMPTS) {
    console.error(`❌ Could not find an open port after ${MAX_ATTEMPTS} attempts.`);
    process.exit(1);
  }

  const server = app.listen(port, () => {
    console.log(`\n✅  GoMico backend running → http://localhost:${port}`);
    if (port !== PORT) {
      console.warn(`⚠️   Default port ${PORT} was busy — using port ${port} instead.`);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️   Port ${port} in use, trying another port...`);
      // Close this server instance to avoid memory leaks or ghost bindings
      server.close();
      // Try the next port
      startServer(port + 1, attempts + 1);
    } else {
      console.error('❌  Unhandled server error:', err);
      process.exit(1);
    }
  });
}

// Start the server
startServer(PORT);
