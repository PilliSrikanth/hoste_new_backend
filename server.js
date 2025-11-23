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
const transaction = require('./routes/transactionRoutes')
const notification = require('./routes/notification')


const app = express();
const PORT = process.env.PORT || 3200;

// ✅ Enable CORS for Angular and other frontend URLs
app.use(cors({
  origin: [
    'http://localhost:4200',
    'http://localhost:62043',
    'https://hostel-find.vercel.app'
  ],
  methods: 'GET,POST,PUT,DELETE',
  credentials: true
}));
app.use(cors());

// ✅ Middleware
app.use(bodyParser.json());  // For JSON requests
app.use(bodyParser.urlencoded({ extended: true })); // For PayU form-urlencoded requests

// ✅ MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully!"))
  .catch((error) => console.error(`MongoDB connection error: ${error}`));

app.use('/api/users', user);
app.use('/api/hostels', hostelRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/chat', chatRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/", transaction);
app.use('/api/notification', notification)



//admin
app.use("/api/owner", ownerRoutes);

// ✅ Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
