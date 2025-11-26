require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const user = require('./routes/userRoutes');
const hostelRoutes = require('./routes/hostelRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const chatRoutes = require('./routes/chatRoutes');
const requestRoutes = require('./routes/requestRoutes');
const ownerRoutes = require('./routes/ownerRoutes');
const reviewRoutes = require("./routes/reviewRoutes");
const transaction = require('./routes/transactionRoutes');
const notification = require('./routes/notification');

const app = express();
const PORT = process.env.PORT || 3200;

/* ----------------------------------------------
    CREATE HTTP SERVER (IMPORTANT FOR SOCKET.IO)
------------------------------------------------*/
const http = require('http');
const server = http.createServer(app);

/* ----------------------------------------------
    SOCKET.IO SETUP
------------------------------------------------*/
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:4200",
      "https://hostel-find.vercel.app",
      "http://localhost:62043"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Save io globally so controllers can use it
global.io = io;

// Socket Events
io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

/* ----------------------------------------------
    MIDDLEWARE
------------------------------------------------*/
app.use(cors({
  origin: [
    "http://localhost:4200",
    "https://hostel-find.vercel.app",
    "http://localhost:57971"
  ],
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* ----------------------------------------------
    DATABASE CONNECTION
------------------------------------------------*/
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully!"))
  .catch((error) => console.error("MongoDB connection error:", error));

/* ----------------------------------------------
    ROUTES
------------------------------------------------*/
app.use('/api/users', user);
app.use('/api/hostels', hostelRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/chat', chatRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/", transaction);
app.use('/api/notification', notification);

// Admin
app.use("/api/owner", ownerRoutes);

/* ----------------------------------------------
    START SERVER
------------------------------------------------*/
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log("⚡ Socket.IO enabled");
});
