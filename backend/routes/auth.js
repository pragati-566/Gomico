const express = require('express');
const router = express.Router();
const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const TEST_MODE = process.env.TEST_MODE === 'true';


// Rate limiting for OTP requests
const rateLimit = require('express-rate-limit');
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many OTP requests, please try again later.'
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

// Send OTP
router.post('/send-otp', otpLimiter, async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    // Generate OTP
    const otp = TEST_MODE ? "1234" : generateOTP();

    // Save OTP to database
    await OTP.findOneAndDelete({ phone }); // Remove any existing OTP
    const otpDoc = new OTP({ phone, otp });
    await otpDoc.save();

    if (TEST_MODE) {
      return res.json({ success: true, otp: "1234", message: 'TEST_MODE: OTP sent successfully' });
    }

    // Send OTP via WhatsApp
    try {
      await sendWhatsAppOTP(phone, otp);
      res.json({ message: 'OTP sent successfully' });
    } catch (error) {
      console.error('Failed to send WhatsApp OTP:', error);
      res.status(500).json({ error: 'Failed to send OTP' });
    }

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP are required' });
    }

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