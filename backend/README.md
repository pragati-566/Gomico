# Gomico Backend

Node.js backend for the Gomico Learning Platform.

## Features

- WhatsApp OTP authentication using MSG91
- User management (Mechanic, Workshop Owner, Student)
- Course management with progress tracking
- Certificate generation
- Admin panel with analytics
- Event management

## Quick Setup

1. **Install Dependencies:**
```bash
cd backend
npm install
```

2. **Environment Setup:**
   - Copy `.env` file and update values
   - Set up MongoDB (local or Atlas)
   - Configure MSG91 WhatsApp API

3. **Seed Database:**
```bash
npm run seed
```

4. **Start Server:**
```bash
npm start
# or for development
npm run dev
```

5. **Test APIs:**
   - Open `http://localhost:3000/backend/test.html` in browser

## MSG91 WhatsApp Setup

### Checklist for WhatsApp OTP Integration:

- [ ] **Website should be live** - Required for WhatsApp Business API approval
- [ ] **Facebook and Instagram pages** - Create business pages for the brand
- [ ] **GST billing** - Set up business billing for MSG91

### MSG91 Setup Steps:

1. **Sign up at MSG91:** https://msg91.com/in/pricing/whatsapp
2. **Choose WhatsApp Business API plan**
3. **Get Integrated Number** (Virtual number for WhatsApp)
4. **Create WhatsApp Template** for OTP messages
5. **Update .env file** with credentials

### Minimum OTP Cost:
- MSG91 WhatsApp API starts from ₹0.30-0.50 per OTP
- Monthly minimum commitment varies by plan
- Test with sandbox first

### Alternative: WATI.io
- https://www.wati.io/
- More user-friendly interface
- Similar pricing structure

## Environment Variables (.env)

```env
# Database
MONGODB_URI=mongodb://localhost:27017/gomico

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# MSG91 WhatsApp API
MSG91_AUTH_KEY=your-msg91-auth-key
MSG91_INTEGRATED_NUMBER=your-msg91-integrated-number
MSG91_TEMPLATE_ID=your-whatsapp-template-id

# Server
PORT=3000
NODE_ENV=development
```

## API Endpoints

### Authentication
- `POST /api/auth/send-otp` - Send WhatsApp OTP
- `POST /api/auth/verify-otp` - Verify OTP
- `POST /api/auth/register` - Register new user

### User
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `GET /api/user/dashboard` - Get dashboard data
- `PUT /api/user/course-progress/:courseSlug` - Update course progress
- `POST /api/user/certificate/:courseSlug` - Generate certificate

### Admin
- `POST /api/admin/login` - Admin login (username: admin, password: 1234)
- `GET /api/admin/dashboard` - Get dashboard metrics
- `GET /api/admin/users` - Get users list with filters
- `PUT /api/admin/users/:userId` - Update user
- `DELETE /api/admin/users/:userId` - Delete user (requires "DELETE" confirmation)
- `PUT /api/admin/users/:userId/status` - Block/unblock user
- `GET /api/admin/export?format=csv&password=1234` - Export users data

### Courses
- `GET /api/course` - Get all courses
- `GET /api/course/:slug` - Get course by slug

### Events
- `GET /api/event` - Get all events
- `POST /api/event` - Create event (admin)
- `PUT /api/event/:id` - Update event (admin)
- `DELETE /api/event/:id` - Delete event (admin)

## Database Models

### User
- phone (unique, Indian mobile validation)
- userType (mechanic/workshop_owner/student)
- profile fields based on user type
- courseProgress (ev_course, bs6_course, ac_course, electrical_course)
- certificates array
- timestamps and IP tracking

### Course
- name, slug, description
- type (video/html)
- content (videos array or chapters array)
- isActive

### Event
- name, description
- location (city, state)
- startDate, endDate
- image (uploaded file path)
- website (optional URL)
- createdBy (admin user)

### OTP
- phone, otp, type
- expiresAt (5 minutes, auto-delete)

## User Journey Implementation

### 1. Homepage → Login/Register
- User enters Indian mobile number
- Backend validates format: /^[6-9]\d{9}$/

### 2. WhatsApp OTP
- MSG91 API sends OTP to WhatsApp
- Rate limited: 5 requests per 15 minutes per IP
- OTP expires in 5 minutes

### 3. User Type Selection
- Mechanic: worksOn (2_wheeler/4_wheeler/both), experience, expertise
- Workshop Owner: workshopName
- Student: age

### 4. Dashboard
- Profile completion check
- Course progress display
- Certificate download when course >= 100%

### 5. Admin Panel
- Dashboard metrics
- User management with filters
- Event CRUD operations
- Data export (CSV/PDF)

## Security Features

- JWT authentication
- Rate limiting on OTP
- Input validation
- Admin role checking
- IP address tracking
- Secure file uploads (images only, 5MB limit)

## Deployment Checklist

- [ ] MongoDB production setup
- [ ] MSG91 production credentials
- [ ] JWT secret changed
- [ ] SSL certificate
- [ ] File upload directory permissions
- [ ] Admin password changed
- [ ] Rate limiting configured
- [ ] CORS settings for production domain

## Testing

Use the included `test.html` file to test all API endpoints:

1. Send OTP to your WhatsApp number
2. Verify OTP
3. Register user
4. Get dashboard
5. Admin login
6. View users

## Frontend Integration

The backend serves the frontend files and provides APIs. Update your frontend JavaScript to call these endpoints:

```javascript
// Example: Send OTP
fetch('/api/auth/send-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '9876543210' })
});

// Example: Get dashboard with auth
fetch('/api/user/dashboard', {
  headers: { 'Authorization': `Bearer ${userToken}` }
});
```

## Support

For MSG91 setup issues:
- Check MSG91 documentation
- Ensure WhatsApp Business API approval
- Verify template message format

For WATI.io alternative:
- More intuitive dashboard
- Better customer support
- Similar pricing

## Checklist for Production

- [ ] Website live
- [ ] Facebook and Instagram pages created
- [ ] GST billing setup
- [ ] MSG91 WhatsApp API configured
- [ ] MongoDB production setup
- [ ] SSL certificate
- [ ] Environment variables configured
- [ ] Admin password changed from default