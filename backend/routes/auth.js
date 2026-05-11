const express = require('express');
const router = express.Router();
const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const TEST_MODE = String(process.env.TEST_MODE || '').replace(/['"]/g, '').trim() === 'true';

// Determine auth mode once at startup
const AUTH_MODE = String(process.env.AUTH_MODE || 'real_otp').replace(/['"]/g, '').trim();
const FIXED_OTP_CODE = String(process.env.FIXED_OTP || '1234').replace(/['"]/g, '').trim();
const IS_FIXED_OTP = AUTH_MODE === 'fixed_otp' || TEST_MODE;

console.log(`[Auth] Mode: ${AUTH_MODE} | Fixed OTP active: ${IS_FIXED_OTP}`);

// In-memory OTP store for fixed_otp mode (no MongoDB dependency)
// Key: phone number, Value: { otp, expiresAt }
const memoryOtpStore = new Map();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [phone, data] of memoryOtpStore) {
    if (data.expiresAt < now) memoryOtpStore.delete(phone);
  }
}, 5 * 60 * 1000);

// Rate limiting for OTP requests
const rateLimit = require('express-rate-limit');
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Too many OTP requests, please try again later.' }
});

// Generate random OTP
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Send OTP via WhatsApp using MSG91
async function sendWhatsAppOTP(phone, otp) {
  try {
    // MSG91 WhatsApp API integration
    const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
    const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;

    const response = await axios.post('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/', {
      integrated_number: process.env.MSG91_INTEGRATED_NUMBER,
      content_type: "template",
      payload: {
        to: `91${phone}`,
        type: "template",
        template: {
          name: MSG91_TEMPLATE_ID,
          language: {
            code: "en"
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: otp
                }
              ]
            }
          ]
        }
      }
    }, {
      headers: {
        'authkey': MSG91_AUTH_KEY,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('WhatsApp OTP send error:', error);
    throw error;
  }
}

// ─── Send OTP ────────────────────────────────────────────────────────
router.post('/send-otp', otpLimiter, async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    if (IS_FIXED_OTP) {
      // ── Fixed OTP mode: store in memory, skip MongoDB entirely ──
      memoryOtpStore.set(phone, {
        otp: FIXED_OTP_CODE,
        expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
      });
      console.log(`[Auth] Fixed OTP stored in memory for ${phone}`);
      return res.json({ success: true, message: 'OTP sent successfully' });
    }

    // ── Real OTP mode: use MongoDB + SMS provider ──
    const otp = generateOTP();

    // Save OTP to database
    await OTP.findOneAndDelete({ phone }); // Remove any existing OTP
    const otpDoc = new OTP({ phone, otp });
    await otpDoc.save();

    // Send OTP via WhatsApp
    try {
      await sendWhatsAppOTP(phone, otp);
      res.json({ success: true, message: 'OTP sent successfully' });
    } catch (error) {
      console.error('Failed to send WhatsApp OTP:', error);
      res.status(500).json({ error: 'Failed to send OTP' });
    }

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Verify OTP ──────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP are required' });
    }

    if (IS_FIXED_OTP) {
      // ── Fixed OTP mode: verify from memory, skip MongoDB ──
      const stored = memoryOtpStore.get(phone);

      if (!stored) {
        return res.status(400).json({ error: 'OTP not found. Please request a new OTP.' });
      }

      if (stored.expiresAt < Date.now()) {
        memoryOtpStore.delete(phone);
        return res.status(400).json({ error: 'OTP expired' });
      }

      if (stored.otp !== otp.trim()) {
        return res.status(400).json({ error: 'Invalid OTP' });
      }

      // OTP is valid — clean up
      memoryOtpStore.delete(phone);
      console.log(`[Auth] Fixed OTP verified for ${phone}`);

      // Try to find user in DB; if DB is down, treat as new user
      try {
        let user = await User.findOne({ phone });

        if (user) {
          // Update last login
          user.lastLogin = new Date();
          user.ipAddress = req.ip;
          await user.save();

          // Generate JWT token
          const token = jwt.sign(
            { userId: user._id, phone: user.phone },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
          );

          return res.json({
            token,
            user: {
              id: user._id,
              phone: user.phone,
              userType: user.userType,
              fullName: user.fullName,
              isProfileComplete: user.isProfileComplete
            },
            isNewUser: false
          });
        }
      } catch (dbErr) {
        console.warn('[Auth] DB lookup failed, treating as new user:', dbErr.message);
      }

      // New user (or DB is down)
      return res.json({
        isNewUser: true,
        phone
      });
    }

    // ── Real OTP mode: verify from MongoDB ──
    // Find OTP in database
    const otpDoc = await OTP.findOne({ phone, otp });

    if (!otpDoc) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Check if OTP is expired
    if (otpDoc.expiresAt < new Date()) {
      await OTP.findByIdAndDelete(otpDoc._id);
      return res.status(400).json({ error: 'OTP expired' });
    }

    // Delete used OTP
    await OTP.findByIdAndDelete(otpDoc._id);

    // Check if user exists
    let user = await User.findOne({ phone });

    if (user) {
      // Update last login
      user.lastLogin = new Date();
      user.ipAddress = req.ip;
      await user.save();

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, phone: user.phone },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: user._id,
          phone: user.phone,
          userType: user.userType,
          fullName: user.fullName,
          isProfileComplete: user.isProfileComplete
        },
        isNewUser: false
      });
    } else {
      // New user - return flag to show onboarding
      res.json({
        isNewUser: true,
        phone
      });
    }

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { phone, userType, ...userData } = req.body;

    // Validate required fields
    if (!phone || !userType) {
      return res.status(400).json({ error: 'Phone and user type are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create new user
    const user = new User({
      phone,
      userType,
      ...userData,
      ipAddress: req.ip
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, phone: user.phone },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        phone: user.phone,
        userType: user.userType,
        fullName: user.fullName,
        isProfileComplete: user.isProfileComplete
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;