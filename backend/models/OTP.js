const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true
  },
  otp: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['login', 'verification'],
    default: 'login'
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    index: { expires: 0 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('OTP', otpSchema);