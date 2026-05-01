const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    match: [/^[6-9]\d{9}$/, 'Please enter a valid Indian mobile number']
  },
  userType: {
    type: String,
    enum: ['mechanic', 'workshop_owner', 'student'],
    required: true
  },
  // Mechanic fields
  fullName: { type: String, required: true },
  worksOn: {
    type: String,
    enum: ['2_wheeler', '4_wheeler', 'both'],
    default: '4_wheeler'
  },
  experience: {
    type: String,
    enum: ['0-1', '2-4', '5-10', '10+', '0-1 Years', '1-3 Years', '3-5 Years', '5-10 Years', '10+ Years']
  },
  city: { type: String, required: true },
  expertise: [{ type: String }],
  referralCode: { type: String },

  // Workshop Owner fields
  workshopName: { type: String },

  // Student fields
  age: { type: Number },

  // Common fields
  isProfileComplete: { type: Boolean, default: false },
  courseProgress: {
    ev_course: { type: Number, default: 0 },
    bs6_course: { type: Number, default: 0 },
    ac_course: { type: Number, default: 0 },
    electrical_course: { type: Number, default: 0 }
  },
  certificates: [{
    courseName: String,
    certificateId: String,
    completionDate: Date,
    pdfUrl: String
  }],
  lastLogin: { type: Date },
  ipAddress: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);