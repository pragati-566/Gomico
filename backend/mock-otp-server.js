const express = require('express');
const app = express();

app.use(express.json());

// Configuration
const IS_DEV_MODE = process.env.NODE_ENV !== 'production';
const FIXED_OTP = '1234';

// In-memory store for OTPs: Map<phone, { otp, expiresAt }>
// For a production system this should be Redis or a database.
const otpStore = new Map();

// Helper to generate a random 4-digit OTP
function generate4DigitOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * @route POST /api/send-otp
 * @desc Generate and return an OTP for testing
 */
app.post('/api/send-otp', (req, res) => {
  try {
    const { phone } = req.body;

    // Validation
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, error: 'Invalid phone number format. Must be 10 digits.' });
    }

    // Determine OTP
    const generatedOtp = IS_DEV_MODE ? FIXED_OTP : generate4DigitOTP();

    // Store OTP with an expiration (e.g., 5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    otpStore.set(phone, { otp: generatedOtp, expiresAt });

    // Response
    // In a real system, you would NEVER return the OTP in the response, 
    // but the prompt requests "generate or return the OTP" for testing purposes.
    return res.status(200).json({
      success: true,
      message: 'OTP processed successfully',
      data: {
        phone,
        otp: generatedOtp, // returning it since we aren't using an external SMS provider
        expiresAt
      }
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route POST /api/verify-otp
 * @desc Verify the submitted OTP
 */
app.post('/api/verify-otp', (req, res) => {
  try {
    const { phone, otp } = req.body;

    // Validation
    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: 'Phone and OTP are required' });
    }

    const storedData = otpStore.get(phone);

    // Check if OTP was requested
    if (!storedData) {
      return res.status(400).json({ success: false, error: 'No OTP found for this phone number' });
    }

    // Check expiration
    if (new Date() > storedData.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ success: false, error: 'OTP has expired' });
    }

    // Verify OTP value
    if (storedData.otp !== otp) {
      return res.status(400).json({ success: false, error: 'Invalid OTP' });
    }

    // Success: Clear the OTP from memory and return success
    otpStore.delete(phone);

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Mock OTP server running on port ${PORT}`);
  console.log(`Development Mode: ${IS_DEV_MODE ? 'ON (Fixed OTP: 1234)' : 'OFF'}`);
});
