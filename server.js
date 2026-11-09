
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const startSubscriptionExpiryJob =require('./jobs/subscriptionExpiryJob');


/* =========================================================
   ROUTES
========================================================= */

const user = require('./routes/userRoutes');
const hostelRoutes = require('./routes/hostelRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const chatRoutes = require('./routes/chatRoutes');
const requestRoutes = require('./routes/requestRoutes');
const ownerRoutes = require('./routes/ownerRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const transaction = require('./routes/transactionRoutes');
const notification = require('./routes/notification');
const adminChatRoutes = require('./routes/adminChatRoutes');
const cosmicPaymentRoutes = require('./routes/rentPaymentRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');

/* =========================================================
   APP SETUP
========================================================= */

const app = express();
const PORT = process.env.PORT || 3200;
const server = http.createServer(app);

/* =========================================================
   ENVIRONMENT CHECK
========================================================= */

console.log('');
console.log('==============================================');
console.log('        HOSTEL BACKEND CONFIGURATION');
console.log('==============================================');

console.log('MongoDB:', process.env.MONGO_URI ? 'LOADED' : 'MISSING');
console.log('JWT Secret:', process.env.JWT_SECRET ? 'LOADED' : 'MISSING');

console.log(
  'Twilio Account SID:',
  process.env.TWILIO_ACCOUNT_SID
    ? `${process.env.TWILIO_ACCOUNT_SID.substring(0, 6)}...`
    : 'MISSING'
);

console.log(
  'Twilio Auth Token:',
  process.env.TWILIO_AUTH_TOKEN
    ? `LOADED (${process.env.TWILIO_AUTH_TOKEN.length} characters)`
    : 'MISSING'
);

console.log(
  'Twilio Verify Service:',
  process.env.TWILIO_VERIFY_SERVICE_SID
    ? `${process.env.TWILIO_VERIFY_SERVICE_SID.substring(0, 6)}...`
    : 'MISSING'
);

console.log('PayU Merchant Key:', process.env.MERCHANT_KEY ? 'LOADED' : 'MISSING');
console.log('PayU Environment:', process.env.PAYU_ENVIRONMENT || 'NOT SET');
console.log('Frontend URL:', process.env.FRONTEND_URL || 'NOT SET');

console.log('==============================================');
console.log('');

/* =========================================================
   ALLOWED ORIGINS
========================================================= */

const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:55187',
  'http://localhost:58250',
  'https://renatlhub-user-web.onrender.com',
  'https://ownerapp-ij57.onrender.com',
  'https://hostel-find.vercel.app',
  'https://pillisrikanth.github.io',
  'https://pillisrikanth.github.io/amgular_admin'
];

/* =========================================================
   CORS
========================================================= */

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header, such as Postman.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log('CORS blocked:', origin);
      return callback(new Error('CORS not allowed'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
);

/* =========================================================
   BODY PARSING
========================================================= */

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

/* =========================================================
   SOCKET.IO
========================================================= */

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true
  }
});

// Make Socket.IO available to Express controllers.
app.set('io', io);

// Retain this if other existing controllers use global.io.
global.io = io;

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Owner/admin chat room
  socket.on('admin-chat:join-admin', (adminId) => {
    if (!adminId || typeof adminId !== 'string') {
      console.log('Invalid admin chat room ID');
      return;
    }

    const room = `admin-${adminId}`;
    socket.join(room);

    console.log(`Socket ${socket.id} joined ${room}`);
  });

  // User chat room
  socket.on('admin-chat:join-user', (userId) => {
    if (!userId || typeof userId !== 'string') {
      console.log('Invalid user chat room ID');
      return;
    }

    const room = `user-${userId}`;
    socket.join(room);

    console.log(`Socket ${socket.id} joined ${room}`);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', socket.id, reason);
  });
});

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Hostel Backend API is running',
    server: 'Node.js + Express + Socket.IO',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

/* =========================================================
   DATABASE CONNECTION
========================================================= */

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is missing in .env file');
} else {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch((error) => console.error('MongoDB connection error:', error.message));
}

/* =========================================================
   API ROUTES
========================================================= */

app.use('/api/users', user);
app.use('/api/admin-chat', adminChatRoutes);
app.use('/api/hostels', hostelRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notification', notification);
app.use('/api/owner', ownerRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
// Once, after creating the Express app:
app.use('/api/notification', require('./routes/notification'));

// Once, after creating the Socket.IO server:
global.io = io;
app.set('io', io);

// Preserve your existing transaction route mounting.
app.use('/', transaction);

app.use('/api/cosmic-payments', cosmicPaymentRoutes);

/* =========================================================
   STATIC UPLOADS
========================================================= */

const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl
  });
});

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use((error, req, res, next) => {
  console.error('Server error:', error.message);

  if (error.message === 'CORS not allowed') {
    return res.status(403).json({
      success: false,
      message: 'CORS not allowed',
      origin: req.headers.origin || null
    });
  }

  return res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error'
  });
});

/* =========================================================
   START SERVER
========================================================= */

server.listen(PORT, () => {
  console.log('');
  console.log('==============================================');
  console.log('          HOSTEL BACKEND STARTED');
  console.log('==============================================');
  console.log(`Server:    http://localhost:${PORT}`);
  console.log(`API:       http://localhost:${PORT}/api`);
  console.log(`User API:  http://localhost:${PORT}/api/users`);
  console.log(`Chat API:  http://localhost:${PORT}/api/admin-chat`);
  console.log(`Hostels:   http://localhost:${PORT}/api/hostels`);
  console.log(`Uploads:   http://localhost:${PORT}/uploads`);
  console.log('Socket.IO enabled');
  console.log('==============================================');
  console.log('');
});
