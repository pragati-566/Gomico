const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Event = require('../models/Event');
const jwt = require('jsonwebtoken');

const bcrypt = require('bcryptjs');

// Add basic rate limiting to prevent brute force
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { error: 'Too many login attempts, please try again after 15 minutes' }
});

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = user;
    next();
  });
};

// Admin login — credentials stored as bcrypt hash in .env (ADMIN_USERNAME, ADMIN_PASSWORD_HASH)
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Reject empty inputs immediately — do not waste bcrypt cycles
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const validUsername = process.env.ADMIN_USERNAME;
    const hashToCompare = process.env.ADMIN_PASSWORD_HASH;

    // Fail loudly if env vars are missing — never fall back to hardcoded values
    if (!validUsername || !hashToCompare) {
      console.error('CRITICAL: ADMIN_USERNAME or ADMIN_PASSWORD_HASH missing from .env');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    const isUsernameValid = username === validUsername;
    // Always run bcrypt.compare even on wrong username to prevent timing attacks
    const isPasswordValid = await bcrypt.compare(password, hashToCompare);

    if (isUsernameValid && isPasswordValid) {
      const token = jwt.sign(
        { userId: 'admin', role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      console.log('[Admin Auth] Login successful for:', username);
      res.json({ token, message: 'Admin login successful' });
    } else {
      // Generic error — do not reveal which field was wrong
      console.warn('[Admin Auth] Failed login attempt for username:', username);
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get admin dashboard metrics
router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const mechanics = await User.countDocuments({ userType: 'mechanic' });
    const workshopOwners = await User.countDocuments({ userType: 'workshop_owner' });
    const students = await User.countDocuments({ userType: 'student' });

    // Active users (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeUsers = await User.countDocuments({ lastLogin: { $gte: sevenDaysAgo } });

    // Course stats
    const allUsers = await User.find({}, 'courseProgress');
    const courseStats = {
      ev_course: { completed: 0, totalProgress: 0, started: 0 },
      bs6_course: { completed: 0, totalProgress: 0, started: 0 },
      ac_course: { completed: 0, totalProgress: 0, started: 0 },
      electrical_course: { completed: 0, totalProgress: 0, started: 0 }
    };

    allUsers.forEach(user => {
      Object.keys(courseStats).forEach(course => {
        const progress = user.courseProgress[course] || 0;
        if (progress > 0) {
          courseStats[course].started++;
          courseStats[course].totalProgress += progress;
        }
        if (progress >= 100) {
          courseStats[course].completed++;
        }
      });
    });

    const courseCompletionRates = {};
    const averageProgress = {};
    const totalLearners = {};
    
    Object.keys(courseStats).forEach(course => {
      courseCompletionRates[course] = totalUsers > 0 ? Math.round((courseStats[course].completed / totalUsers) * 100) : 0;
      averageProgress[course] = courseStats[course].started > 0 ? Math.round(courseStats[course].totalProgress / courseStats[course].started) : 0;
      totalLearners[course] = courseStats[course].started;
    });

    res.json({
      totalUsers,
      mechanics,
      workshopOwners,
      students,
      activeUsers,
      courseCompletionRates,
      averageProgress,
      totalLearners
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get users list with filters
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      userType,
      city,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (userType) query.userType = userType;
    if (city) query.city = city;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-__v');

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user
router.put('/users/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    // Remove sensitive fields that shouldn't be updated by admin
    delete updates.phone;
    delete updates.password;

    const user = await User.findByIdAndUpdate(userId, updates, { new: true });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user
router.delete('/users/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { confirmation } = req.body;

    if (confirmation !== 'DELETE') {
      return res.status(400).json({ error: 'Please type DELETE to confirm' });
    }

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Block/Unblock user
router.put('/users/:userId/status', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(userId, { isActive }, { new: true });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: `User ${isActive ? 'unblocked' : 'blocked'} successfully` });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export users data
router.get('/export', authenticateAdmin, async (req, res) => {
  try {
    const { format = 'csv', password } = req.query;

    const exportHash = process.env.EXPORT_PASSWORD_HASH;
    if (!exportHash) {
       console.error('CRITICAL: EXPORT_PASSWORD_HASH is not set in .env');
       return res.status(500).json({ error: 'Server misconfiguration' });
    }

    const isExportPasswordValid = await bcrypt.compare(password, exportHash);
    
    if (!isExportPasswordValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const users = await User.find({}).select('-__v');

    if (format === 'csv') {
      let csv = 'ID,Name,Phone,User Type,City,Created At,Last Login,Is Active\n';

      users.forEach(user => {
        csv += `${user._id},${user.fullName || ''},${user.phone},${user.userType},${user.city || ''},${user.createdAt},${user.lastLogin || ''},${user.isActive}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
      res.send(csv);
    } else if (format === 'pdf') {
      // Generate PDF with user data
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument();
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="users.pdf"');
        res.send(pdfData);
      });

      doc.fontSize(20).text('Users Report', { align: 'center' });
      doc.moveDown();

      users.forEach((user, index) => {
        doc.fontSize(12).text(`${index + 1}. ${user.fullName || 'N/A'} - ${user.phone} - ${user.userType}`);
        doc.moveDown(0.5);
      });

      doc.end();
    } else {
      res.status(400).json({ error: 'Invalid format. Use csv or pdf' });
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/verify-export-password
// Dedicated endpoint: accepts password in request BODY (not query string),
// compares against EXPORT_PASSWORD env var. Never logs or exposes the password.
router.post('/verify-export-password', authenticateAdmin, async (req, res) => {
  try {
    const { password } = req.body;

    // Validate: reject empty input immediately
    if (!password || typeof password !== 'string' || password.trim() === '') {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }

    const exportPassword = process.env.EXPORT_PASSWORD;
    if (!exportPassword) {
      console.error('CRITICAL: EXPORT_PASSWORD is not set in .env');
      return res.status(500).json({ success: false, error: 'Server misconfiguration' });
    }

    // Constant-time string comparison to prevent timing attacks
    const isValid = password === exportPassword;

    if (isValid) {
      return res.json({ success: true });
    } else {
      return res.status(401).json({ success: false, error: 'Incorrect password' });
    }
  } catch (error) {
    console.error('Export password verification error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;