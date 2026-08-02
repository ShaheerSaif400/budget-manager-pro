require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');

const connectDB = require('./config/db');
const Expense = require('./models/Expense');
const User = require('./models/User');

const app = express();

// Database Connection
connectDB();
// MongoDB Connect hone ke baad chalayein (Single time Migration)
// app.js mein connectDB(); ke niche paste karein:
mongoose.connection.once('open', async () => {
  try {
    // First existing user fetch karein
    const user = await mongoose.model('User').findOne();
    if (user) {
      // Un tamaam records mein jahan userId null/undefined hai, unhe current user se connect kar do
      const result = await Expense.updateMany(
        { $or: [{ userId: { $exists: false } }, { userId: null }] },
        { $set: { userId: user._id } }
      );

    }
  } catch (err) {
    console.error("Migration Error:", err);
  }
});

// Middleware & View Engine Setup
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// Serve Public & Uploaded Files
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Multer Storage Configuration (File Uploads Ke Liye)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Express Session Management
app.use(session({
  secret: 'mysecretkey123',
  resave: false,
  saveUninitialized: false
}));

// Auth Protection Middleware
const isAuth = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
};


// ================= ROUTES =================

// 1. HOME / LANDING PAGE
app.get('/', (req, res) => {
  res.render('landing', { user: req.session.user || null });
});

// 2. DASHBOARD PAGE WITH SEARCH, FILTERING & PAGINATION (home.ejs)
app.get('/dashboard', isAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    // Direct String / ObjectId double compatibility
    const userId = req.session.user._id;

    // Fetch user transactions matching userId
    const allUserExpenses = await Expense.find({ 
      $or: [{ userId: userId }, { userId: userId.toString() }] 
    });

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryTotals = {};

    allUserExpenses.forEach(exp => {
      const typeVal = String(exp.type || '').toLowerCase();
      const catVal = String(exp.category || '').toLowerCase();
      const amt = Number(exp.amount) || 0;

      if (typeVal === 'income' || catVal === 'salary' || catVal === 'pocket money') {
        totalIncome += amt;
      } else {
        totalExpense += amt;
        const categoryKey = exp.category || 'Other';
        categoryTotals[categoryKey] = (categoryTotals[categoryKey] || 0) + amt;
      }
    });

    // Pagination query
    let filter = { $or: [{ userId: userId }, { userId: userId.toString() }] };

    if (req.query.search) {
      filter.title = { $regex: req.query.search, $options: 'i' };
    }
    if (req.query.category && req.query.category !== 'all') {
      filter.category = req.query.category;
    }

    const totalExpensesCount = await Expense.countDocuments(filter);
    const expenses = await Expense.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    res.render('home', {
      user: req.session.user,
      expenses,
      currentPage: page,
      totalPages: Math.ceil(totalExpensesCount / limit) || 1,
      query: req.query,
      totalIncome,
      totalExpense,
      categoryChartData: JSON.stringify(categoryTotals)
    });

  } catch (err) {
    console.error("Dashboard Fetch Error:", err);
    res.status(500).send("Server Error");
  }
});

// 1. DELETE TRANSACTION ROUTE
// SECURE DELETE TRANSACTION ROUTE
app.post('/expense/delete/:id', async (req, res) => {
  try {
    const expenseId = req.params.id;

    // Security Match: Ensured that user can only delete their own transaction
    const deletedExpense = await Expense.findOneAndDelete({
      _id: expenseId,
      userId: req.session.user._id
    });

    if (!deletedExpense) {
      return res.status(403).send("Unauthorized action or item not found.");
    }

    res.redirect('/dashboard');
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).send("Error deleting transaction");
  }
});

// SECURE EDIT TRANSACTION ROUTE
app.post('/expense/edit/:id', async (req, res) => {
  try {
    const expenseId = req.params.id;
    const { title, amount, category, type, date } = req.body;

    let formattedType = 'Expense';
    if (type && typeof type === 'string') {
      formattedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    }

    // Security Match: Ensured that transaction belongs to active logged-in user
    const updatedExpense = await Expense.findOneAndUpdate(
      { _id: expenseId, userId: req.session.user._id },
      {
        title,
        amount: Number(amount) || 0,
        category,
        type: formattedType,
        date: date ? new Date(date) : new Date()
      },
      { new: true }
    );

    if (!updatedExpense) {
      console.warn("Unauthorized attempt or transaction not found.");
      return res.status(403).send("Unauthorized action or item not found.");
    }

    res.redirect('/dashboard');
  } catch (err) {
    console.error("Edit Error:", err);
    res.status(500).send("Error updating transaction");
  }
});
// 3. Financial Blog Page
app.get('/blogs', (req, res) => {
  res.render('blogs', { user: req.session.user });
});

// 4. Authentication Routes
app.get('/login', (req, res) => {
  res.render('login', { user: req.session.user });
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const checkUser = await User.findOne({ email });
    
    if (!checkUser) return res.send('User not found!');

    const match = await bcrypt.compare(password, checkUser.password);
    if (!match) return res.send('Incorrect password!');

    req.session.user = checkUser;
    res.redirect('/dashboard');
  } catch (err) {
    res.status(500).send('Login Error');
  }
});

app.get('/signup', (req, res) => {
  res.render('signup', { user: req.session.user });
});

// Post route with multer middleware added
app.post('/signup', upload.single('avatar'), async (req, res) => {
  try {
    const { name, email, password } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.send('Email already exists');

    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash(password, salt);

    let avatarPath = '';
    if (req.file) {
      avatarPath = '/uploads/' + req.file.filename;
    }

    await User.create({ 
      name, 
      email, 
      password: passHash,
      avatar: avatarPath 
    });
    
    res.redirect('/login');
  } catch (err) {
    console.error("Signup Error Detailed:", err);
    res.status(500).send('Signup Error: ' + err.message);
  }
});

// 5. Expense Transactions Route (POST ONLY)
// 5. Save Transaction Route
app.post('/add-expense', isAuth, async (req, res) => {
  try {
    let { type, title, amount, category } = req.body;

    // Capitalize type to match Mongoose schema ('Expense' / 'Income')
    if (type) {
      type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    }

    // Save transaction with active User ID attached
    await Expense.create({
      userId: req.session.user._id,
      type: type || 'Expense',
      title,
      amount: Number(amount),
      category,
      date: new Date()
    });

    res.redirect('/dashboard');
  } catch (err) {
    console.error("Save Expense Error:", err);
    res.redirect('/dashboard'); // Error aaye tab bhi dashboard par wapas chala jaye
  }
});
// 6. Analytics Page
// 6. Analytics Page (FIXED)
app.get('/analytics', isAuth, async (req, res) => {
  try {
    const userId = req.session.user._id;
    // Sirf logged-in user ki transactions fetch karein
    const userExpenses = await Expense.find({
      $or: [{ userId: userId }, { userId: userId.toString() }]
    });

    res.render('analytics', { expenses: userExpenses, user: req.session.user });
  } catch (err) {
    console.error("Analytics Fetch Error:", err);
    res.status(500).send('Analytics page load error');
  }
});

// 7. Profile View Route (FIXED)
app.get('/profile', isAuth, async (req, res) => {
  try {
    const userId = req.session.user._id;
    // Sirf logged-in user ki transactions fetch karein
    const userExpenses = await Expense.find({
      $or: [{ userId: userId }, { userId: userId.toString() }]
    });

    res.render('profile', { expenses: userExpenses, user: req.session.user });
  } catch (err) {
    console.error("Profile Fetch Error:", err);
    res.status(500).send('Profile Error');
  }
});

// 8. Profile Update Route
app.post('/profile/update', isAuth, upload.single('avatarFile'), async (req, res) => {
  try {
    const { name, email, avatarUrl } = req.body;
    let finalAvatar = req.session.user.avatar || '';

    if (req.file) {
      finalAvatar = '/uploads/' + req.file.filename;
    } 
    else if (avatarUrl && avatarUrl.trim() !== '') {
      finalAvatar = avatarUrl;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.session.user._id,
      { name, email, avatar: finalAvatar },
      { new: true }
    );

    req.session.user = updatedUser;
    res.redirect('/profile');
  } catch (err) {
    console.log(err);
    res.status(500).send('Profile update error');
  }
});

// 9. Logout Route
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Server Start
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});