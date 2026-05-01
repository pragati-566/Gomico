const mongoose = require('mongoose');
const Course = require('./models/Course');
require('dotenv').config();

const seedCourses = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gomico');

    // Clear existing courses
    await Course.deleteMany({});

    // Seed courses
    const courses = [
      {
        name: 'EV Repair Basics',
        slug: 'ev_course',
        description: 'Learn the fundamentals of Electric Vehicle repair and maintenance',
        type: 'video',
        content: {
          videos: [
            { title: 'Introduction to EV Systems', url: '/videos/ev-intro.mp4' },
            { title: 'Battery Management Systems', url: '/videos/ev-battery.mp4' },
            { title: 'Electric Motor Basics', url: '/videos/ev-motor.mp4' },
            { title: 'Charging Systems', url: '/videos/ev-charging.mp4' },
            { title: 'Safety Protocols', url: '/videos/ev-safety.mp4' }
          ]
        }
      },
      {
        name: 'BS6 & DPF System',
        slug: 'bs6_course',
        description: 'Complete guide to BS6 emission standards and DPF systems',
        type: 'html',
        content: {
          chapters: [
            { title: 'BS6 Overview', content: 'Introduction to BS6 standards...', order: 1 },
            { title: 'DPF Components', content: 'Understanding DPF system components...', order: 2 },
            { title: 'Maintenance Procedures', content: 'Regular maintenance for BS6 vehicles...', order: 3 },
            { title: 'Troubleshooting', content: 'Common issues and solutions...', order: 4 }
          ]
        }
      },
      {
        name: 'Car AC Repair',
        slug: 'ac_course',
        description: 'Comprehensive AC system repair and maintenance course',
        type: 'html',
        content: {
          chapters: [
            { title: 'AC System Basics', content: 'Understanding automotive AC systems...', order: 1 },
            { title: 'Refrigerant Handling', content: 'Safe handling of refrigerants...', order: 2 },
            { title: 'Compressor Repair', content: 'Compressor maintenance and repair...', order: 3 },
            { title: 'Leak Detection', content: 'Finding and fixing AC leaks...', order: 4 }
          ]
        }
      },
      {
        name: 'Automobile Electrical',
        slug: 'electrical_course',
        description: 'Complete electrical systems and wiring course',
        type: 'html',
        content: {
          chapters: [
            { title: 'Electrical Fundamentals', content: 'Basic electrical concepts...', order: 1 },
            { title: 'Wiring Diagrams', content: 'Reading and understanding wiring diagrams...', order: 2 },
            { title: 'Battery Systems', content: 'Battery maintenance and testing...', order: 3 },
            { title: 'Lighting Systems', content: 'Automotive lighting repair...', order: 4 }
          ]
        }
      }
    ];

    await Course.insertMany(courses);
    console.log('Courses seeded successfully');

    mongoose.connection.close();
  } catch (error) {
    console.error('Seeding error:', error);
    mongoose.connection.close();
  }
};

seedCourses();