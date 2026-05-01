const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Course = require('../models/Course');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Get user dashboard data
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all courses to show progress for each
    const courses = await Course.find({ isActive: true });
    
    // Map progress for each course
    const courseData = courses.map(course => {
      const progress = user.courseProgress[course.slug] || 0;
      return {
        name: course.name,
        slug: course.slug,
        progress: progress,
        completed: progress === 100
      };
    });

    res.json({
      user,
      courses: courseData
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { fullName, city, experience, workshopName } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (fullName) user.fullName = fullName;
    if (city) user.city = city;
    if (experience) user.experience = experience;
    if (workshopName) user.workshopName = workshopName;

    await user.save();
    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update course progress
router.all('/course-progress/:courseSlug', authenticateToken, async (req, res) => {
  try {
    const { courseSlug } = req.params;
    const { progress } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.courseProgress[courseSlug] = progress;
    user.markModified('courseProgress'); // Required to save nested object changes
    await user.save();

    res.json({ message: 'Progress updated', progress: user.courseProgress[courseSlug] });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Generate certificate
router.post('/certificate/:courseSlug', authenticateToken, async (req, res) => {
  try {
    const { courseSlug } = req.params;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if course is completed
    if ((user.courseProgress[courseSlug] || 0) < 100) {
      return res.status(400).json({ error: 'Course not completed' });
    }

    // Generate certificate ID (or use existing)
    const existingCert = user.certificates.find(cert => cert.courseName === courseSlug);
    const certificateId = existingCert ? existingCert.certificateId : `GOM-${Date.now()}-${user._id.toString().slice(-6).toUpperCase()}`;

    // Fetch course details for dynamic name
    const course = await Course.findOne({ slug: courseSlug });
    const courseDisplayName = (course && course.name) ? course.name : "Training Program";

    // Create PDF certificate (A4 Landscape: 841.89 x 595.28)
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 0
    });

    const width = doc.page.width;
    const height = doc.page.height;

    // Stream directly to response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Certificate_${courseSlug}.pdf"`);
    doc.pipe(res);

    // Save certificate record in background
    if (!existingCert) {
      user.certificates.push({
        courseName: courseSlug,
        certificateId,
        completionDate: new Date(),
        pdfUrl: `/certificates/${certificateId}.pdf`
      });
      user.save().catch(err => console.error('Error saving certificate record:', err));
    }

    // --- Generate certificate content ---
    // 1. Background
    doc.rect(0, 0, width, height).fill('#ffffff');

    // 2. Sophisticated Background Design
    doc.save();
    doc.strokeColor('#f2f2f2').lineWidth(0.5);
    // Concentric Arcs in all four corners
    const drawArcs = (x, y) => {
      for (let i = 1; i <= 25; i++) {
        doc.circle(x, y, i * 18).stroke();
      }
    };
    drawArcs(0, 0);
    drawArcs(width, 0);
    drawArcs(0, height);
    drawArcs(width, height);

    // Wavy "Snakes" Pattern (Guilloche effect)
    doc.strokeColor('#f6f6f6').lineWidth(0.4);
    for (let i = 40; i < height - 40; i += 20) {
      doc.moveTo(40, i);
      for (let x = 40; x < width - 40; x += 10) {
        const y = i + Math.sin(x / 30) * 8;
        doc.lineTo(x, y);
      }
      doc.stroke();
    }

    // Bold Corner "Snakes" (Dark Green Abstract Shapes)
    doc.save();
    doc.strokeColor('#537F00').lineWidth(12).lineCap('round').opacity(0.8);
    // Top Left Snake
    doc.moveTo(0, 50).bezierCurveTo(40, 60, 60, 20, 100, 0).stroke();
    doc.moveTo(0, 80).bezierCurveTo(60, 100, 100, 40, 150, 0).stroke();
    // Bottom Right Snake
    doc.moveTo(width, height - 50).bezierCurveTo(width - 40, height - 60, width - 60, height - 20, width - 100, height).stroke();
    doc.moveTo(width, height - 80).bezierCurveTo(width - 60, height - 100, width - 100, height - 40, width - 150, height).stroke();
    doc.restore();
    
    // Border
    doc.strokeColor('#e0e0e0').lineWidth(1).rect(15, 15, width - 30, height - 30).stroke();
    doc.restore();

    // 3. Official GoMico Logo Symbol (Centered Top)
    const brandGreen = '#70a400'; // Deep professional green from the image
    const symbolScale = 0.95;
    const symbolW = 52 * symbolScale;
    const symbolX = (width - symbolW) / 2;
    const symbolY = 35;

    doc.save();
    doc.translate(symbolX, symbolY);
    doc.scale(symbolScale);
    doc.fillColor(brandGreen);
    doc.path("M51.5443 25.9003C51.5137 32.3095 49.1431 38.1643 45.2431 42.6589C45.2028 42.7057 45.1625 42.7508 45.1222 42.7959C43.5332 44.5993 40.6695 44.43 39.29 42.4623L37.514 39.9289C37.3271 39.6614 37.369 39.2956 37.6139 39.078C38.4858 38.3029 39.2803 37.4423 39.9845 36.5108C40.2279 36.1885 40.7162 36.203 40.9483 36.5334H40.9499L41.3979 37.1748C41.3979 37.1748 41.3979 37.1764 41.3979 37.178C42.0473 38.1047 43.4285 38.0563 44.0247 37.0942C44.0892 36.9911 44.1521 36.8863 44.2149 36.7816C46.1536 33.5455 47.2608 29.7535 47.2479 25.7037C47.2108 13.9827 37.6591 4.38426 25.9381 4.29562C14.0013 4.20538 4.29804 13.8554 4.29804 25.773C4.29804 29.7648 5.38585 33.5036 7.2875 36.7058C7.302 36.7316 7.31651 36.7574 7.33101 36.7816C7.39547 36.8895 7.45994 36.9959 7.52601 37.1023C8.12068 38.0595 9.49373 38.1063 10.14 37.1828H10.1416H10.1432L10.5944 36.5382C10.8281 36.2062 11.3196 36.1917 11.5646 36.5156C12.2688 37.4455 13.0633 38.3045 13.9336 39.078C14.1786 39.2956 14.2205 39.6598 14.0335 39.9289L12.2576 42.4623C10.8765 44.4317 8.01109 44.5993 6.42209 42.7943C6.38341 42.7492 6.34312 42.7041 6.30444 42.6589C2.37545 38.1337 0 32.2305 0 25.773C0 11.4719 11.6484 -0.108785 25.9736 0.000801903C40.1199 0.108777 51.612 11.7539 51.5443 25.9003Z").fill();
    doc.path("M37.1996 31.191C37.5138 31.6391 37.5428 32.2337 37.2592 32.7043C37.2576 32.7075 37.256 32.7107 37.2544 32.7124C36.8531 33.3747 36.397 33.9984 35.891 34.5785C35.2915 35.2667 34.2085 35.2167 33.6847 34.4706L31.7525 31.7148C31.7525 31.7148 31.7509 31.7148 31.7492 31.7116C31.6235 31.5101 31.4866 31.3151 31.3415 31.1282C31.3335 31.1169 31.3254 31.1056 31.3157 31.0943C31.0724 30.7849 30.8049 30.4965 30.5132 30.2322C29.3287 29.1524 27.7719 28.4723 26.0604 28.4046C25.9653 28.3998 25.8686 28.3982 25.772 28.3982C25.6382 28.3982 25.506 28.4014 25.3755 28.4095C23.6495 28.5046 22.0895 29.2217 20.9147 30.3401C20.6585 30.5835 20.4216 30.8462 20.204 31.125C20.2024 31.1282 20.1992 31.1314 20.1976 31.1346C20.0638 31.3055 19.9397 31.4843 19.8221 31.6681C19.8172 31.6745 19.8124 31.6826 19.8076 31.689L17.8576 34.4706C17.3338 35.2183 16.2508 35.2667 15.6513 34.5802C15.1453 34 14.6892 33.3747 14.2896 32.7124C14.2896 32.7091 14.2863 32.7075 14.2847 32.7043C13.9995 32.2353 14.0285 31.6391 14.3443 31.1894L15.9817 28.8543L15.9849 28.8494L16.1976 28.5465L16.2138 28.5223C16.7778 27.7455 17.4337 27.0396 18.167 26.4224C19.3853 25.3942 20.8148 24.6094 22.3812 24.1404C23.3562 23.8487 24.3844 23.6779 25.448 23.6505C25.556 23.6473 25.664 23.6457 25.772 23.6457C25.8799 23.6457 25.9879 23.6457 26.0943 23.6489C27.1257 23.6779 28.1232 23.8375 29.0708 24.113C30.6228 24.5643 32.0426 25.3249 33.2577 26.3225C34.0328 26.9607 34.7258 27.6939 35.3156 28.5046L35.335 28.532L35.5574 28.8494L35.5687 28.8672L35.5751 28.8768L35.5912 28.901L37.1996 31.1927V31.191Z").fill();
    doc.path("M25.772 44.0497C27.7149 44.0497 29.29 42.4746 29.29 40.5316C29.29 38.5887 27.7149 37.0136 25.772 37.0136C23.829 37.0136 22.2539 38.5887 22.2539 40.5316C22.2539 42.4746 23.829 44.0497 25.772 44.0497Z").fill();
    doc.path("M27.954 1.6897V19.0817C27.3496 18.9689 26.7276 18.9012 26.0942 18.8835C25.9879 18.8819 25.8799 18.8803 25.7719 18.8803C25.6639 18.8803 25.556 18.8803 25.448 18.8835C24.8146 18.9012 24.1942 18.9689 23.5898 19.0833V1.6897H27.954Z").fill();
    doc.restore();

    // 4. "GoMico" Brand Text (Centered below symbol)
    doc.fillColor('#002D44').font('Helvetica-Bold').fontSize(26).text('GoMico', 0, 90, { width, align: 'center' });

    // 5. "GoMico India" Title
    doc.fontSize(48).text('GoMico India', 0, 120, { width, align: 'center' });

    // 6. Ribbon Banner
    const ribbonY = 185;
    const ribbonW = 560;
    const ribbonH = 46;
    const ribbonX = (width - ribbonW) / 2;
    doc.save();
    doc.fillColor(brandGreen);
    doc.rect(ribbonX, ribbonY, ribbonW, ribbonH).fill();
    // Ribbon Notches
    doc.path(`M ${ribbonX - 30} ${ribbonY + 23} L ${ribbonX} ${ribbonY} L ${ribbonX} ${ribbonY + ribbonH} Z`).fill();
    doc.path(`M ${ribbonX + ribbonW + 30} ${ribbonY + 23} L ${ribbonX + ribbonW} ${ribbonY} L ${ribbonX + ribbonW} ${ribbonY + ribbonH} Z`).fill();
    doc.restore();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('CERTIFICATE OF COMPLETION', 0, ribbonY + 12, { width, align: 'center' });

    // 7. Dynamic Course Name (BRAND GREEN, BOLD, LARGER)
    doc.fillColor(brandGreen).font('Helvetica-Bold').fontSize(24).text(courseDisplayName, 0, 245, { width, align: 'center' });

    // 8. Certification Statement
    doc.fillColor('#4D5E6A').font('Helvetica').fontSize(16).text('This is to certify that', 0, 295, { width, align: 'center' });

    // 9. Name (Dynamic)
    doc.fillColor('#002D44').font('Helvetica-Bold').fontSize(42).text(user.fullName, 0, 325, { width, align: 'center' });
    // Underline
    doc.moveTo(width/2 - 250, 370).lineTo(width/2 + 250, 370).lineWidth(1.2).strokeColor('#cccccc').stroke();

    // 10. Description Text
    const descW = 650;
    const descX = (width - descW) / 2;
    doc.fillColor('#4D5E6A').font('Helvetica').fontSize(15).text(`has successfully completed the foundational module on ${courseDisplayName}, demonstrating proficiency in the subject matter, technical diagnostics, and industry-standard safety protocols.`, descX, 400, { 
      width: descW, 
      align: 'center',
      lineGap: 4
    });

    // 11. Centered Date Label
    const sigY = 490;
    const dateW = 200;
    const dateX = (width - dateW) / 2;

    doc.moveTo(dateX, sigY).lineTo(dateX + dateW, sigY).lineWidth(0.8).strokeColor('#cccccc').stroke();
    doc.fillColor('#002D44').font('Helvetica-Bold').fontSize(13).text('Date', dateX, sigY + 10, { width: dateW, align: 'center' });

    // Dynamic Date above the Date line
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const d = new Date();
    const formattedDate = `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
    doc.fillColor('#002D44').font('Helvetica-Bold').fontSize(16).text(formattedDate, dateX, sigY - 25, { width: dateW, align: 'center' });

    // 12. Legal Footer
    const footerMargin = 60;
    const footerWidth = width - (footerMargin * 2);
    
    doc.fontSize(8.5).fillColor('#999999').text('This e-certificate validates that the recipient has completed the GoMico theoretical training modules through online attendance. Please note that this document serves strictly as a record of module completion and does not verify practical proficiency, on-ground expertise, or safety compliance. GoMico assumes no liability for any technical work, repairs, or services performed by the certificate holder. As this is a computer-generated certificate, no signature is required.', footerMargin, 535, {
      width: footerWidth,
      align: 'center',
      lineGap: 2
    });

    doc.end();
  } catch (error) {
    console.error('Generate certificate error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

module.exports = router;