
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const startSubscriptionExpiryJob = require('./jobs/subscriptionExpiryJob');

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
console.log('       HOSTEL BACKEND CONFIGURATION');
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

console.log(
  'PayU Merchant Key:',
  process.env.MERCHANT_KEY ? 'LOADED' : 'MISSING'
);

console.log(
  'PayU Environment:',
  process.env.PAYU_ENVIRONMENT || 'NOT SET'
);

console.log(
  'Frontend URL:',
  process.env.FRONTEND_URL || 'NOT SET'
);

console.log('==============================================');
console.log('');

/* =========================================================
   ALLOWED FRONTEND ORIGINS
========================================================= */

const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:55187',
  'http://localhost:58250',

  // User application
  'https://renatlhub-user-web.onrender.com',

  // Owner application
  'https://ownerapp-ij57.onrender.com',

  // Existing frontend domains
  'https://hostel-find.vercel.app',
  'https://pillisrikanth.github.io',
  'https://pillisrikanth.github.io/amgular_admin'
];

/* =========================================================
   SHARED CORS CONFIGURATION
========================================================= */

const corsOptions = {
  origin: (origin, callback) => {

    // Allow requests without Origin (Postman/server-to-server).
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log('CORS BLOCKED:', origin);

    return callback(new Error('CORS not allowed'));
  },

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS'
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization'
  ],

  credentials: true
};

// Express CORS
app.use(cors(corsOptions));

// Handle preflight requests.
app.options(/.*/, cors(corsOptions));

/* =========================================================
   BODY PARSING
========================================================= */

app.use(bodyParser.json({
  limit: '10mb'
}));

app.use(bodyParser.urlencoded({
  extended: true,
  limit: '10mb'
}));

/* =========================================================
   SOCKET.IO CONFIGURATION
========================================================= */

const io = new Server(server, {
  cors: corsOptions,

  transports: ['websocket', 'polling'],

  pingTimeout: 60000,

  pingInterval: 25000
});

// Share Socket.IO with controllers.
app.set('io', io);
global.io = io;

/* =========================================================
   SOCKET CONNECTION EVENTS
========================================================= */

io.on('connection', (socket) => {

  console.log('Socket connected:', socket.id);

  // Owner/admin chat room.
  socket.on('admin-chat:join-admin', (adminId) => {

    if (!adminId || typeof adminId !== 'string') {
      console.log('Invalid admin chat room ID');
      return;
    }

    const room = `admin-${adminId}`;

    socket.join(room);

    console.log(`Socket ${socket.id} joined ${room}`);
  });

  // User chat room.
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

    console.log(
      'Socket disconnected:',
      socket.id,
      reason
    );

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

    database:
      mongoose.connection.readyState === 1
        ? 'Connected'
        : 'Disconnected',

    socketIO: 'Enabled',

    timestamp: new Date().toISOString()
  });

});

/* =========================================================
   DATABASE CONNECTION
========================================================= */

if (!process.env.MONGO_URI) {

  console.error('ERROR: MONGO_URI is missing');

} else {

  mongoose
    .connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000
    })
    .then(() => {

      console.log('MongoDB connected successfully');

    })
    .catch((error) => {

      console.error(
        'MongoDB connection error:',
        error.message
      );

    });

}

// Monitor database connection.
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

mongoose.connection.on('error', (error) => {
  console.error('MongoDB error:', error.message);
});

/* =========================================================
   API ROUTES
========================================================= */

// User authentication and user APIs.
app.use('/api/users', user);

// Admin chat.
app.use('/api/admin-chat', adminChatRoutes);

// Hostel APIs.
app.use('/api/hostels', hostelRoutes);

// Booking APIs.
app.use('/api/bookings', bookingRoutes);

// User and owner chat.
app.use('/api/chat', chatRoutes);

// Requests.
app.use('/api/requests', requestRoutes);

// Reviews.
app.use('/api/reviews', reviewRoutes);

// Notifications - mounted only once.
app.use('/api/notification', notification);

// Owner APIs.
app.use('/api/owner', ownerRoutes);

// Subscription APIs.
app.use('/api/subscriptions', subscriptionRoutes);

// Transaction APIs.
app.use('/', transaction);

// Rent payment APIs.
app.use('/api/cosmic-payments', cosmicPaymentRoutes);

/* =========================================================
   STATIC IMAGE UPLOADS
========================================================= */

const uploadsPath = path.join(__dirname, 'uploads');

app.use(
  '/uploads',
  express.static(uploadsPath)
);

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {

  console.log(
    'API endpoint not found:',
    req.method,
    req.originalUrl
  );

  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    method: req.method,
    path: req.originalUrl
  });

});

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use((error, req, res, next) => {

  console.error(
    'Server error:',
    error.message
  );

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

server.listen(PORT, '0.0.0.0', () => {

  console.log('');

  console.log('==============================================');
  console.log('          HOSTEL BACKEND STARTED');
  console.log('==============================================');

  console.log(`Port:      ${PORT}`);
  console.log(`API:       /api`);
  console.log(`User API:  /api/users`);
  console.log(`Chat API:  /api/admin-chat`);
  console.log(`Hostels:   /api/hostels`);
  console.log(`Bookings:  /api/bookings`);
  console.log(`Owner:     /api/owner`);
  console.log(`Uploads:   /uploads`);

  console.log('Socket.IO enabled');

  console.log('==============================================');

  console.log('');

  // Start subscription expiry job after server startup.
  if (typeof startSubscriptionExpiryJob === 'function') {

    try {

      startSubscriptionExpiryJob();

      console.log('Subscription expiry job started');

    } catch (error) {

      console.error(
        'Subscription expiry job error:',
        error.message
      );

    }

  } else {

    console.log(
      'Subscription expiry job not started: export is not a function'
    );

  }

});
