require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');

const connectDB = require('./config/db');
const Expense = require('./models/Expense');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const expenseRoutes = require('./routes/expenseRoutes');

const app = express();

// Database Connection
connectDB();

mongoose.connection.once('open', async () => {
  try {
    const user = await mongoose.model('User').findOne();
    if (user) {
      await Expense.updateMany(
        { $or: [{ userId: { $exists: false } }, { userId: null }] },
        { $set: { userId: user._id } }
      );
    }
  } catch (err) {
    console.error("Migration Error:", err);
  }
});

// View Engine & Core Middlewares Setup
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// Serve Public & Uploaded Files
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Express Session Management
app.use(session({
  secret: 'mysecretkey123',
  resave: false,
  saveUninitialized: false
}));

// Use Modularized Routes
app.use('/', authRoutes);
app.use('/', expenseRoutes);

// Server Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});