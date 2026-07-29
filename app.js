require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');

const connectDB = require('./config/db');
const Expense = require('./models/Expense');
const User = require('./models/User');

const app = express();

// Database Connection
connectDB();

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
    const { search, category, startDate, endDate, page } = req.query;

    // 1. Build Query Filter
    // Filter by userId IF exists, otherwise show user's records or all unassigned
    let userIdFilter = req.session.user ? req.session.user._id : null;
    let queryFilter = {
      $or: [
        { userId: userIdFilter },
        { userId: { $exists: false } } // Retain existing older records that have no userId
      ]
    };

    if (search) {
      queryFilter.$and = [
        {
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { category: { $regex: search, $options: 'i' } }
          ]
        }
      ];
    }

    if (category && category !== 'all') {
      queryFilter.category = category;
    }

    if (startDate || endDate) {
      queryFilter.date = {};
      if (startDate) queryFilter.date.$gte = new Date(startDate);
      if (endDate) {
        let eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        queryFilter.date.$lte = eDate;
      }
    }

    // 2. Pagination Logic
    const limit = 5;
    const pageNum = parseInt(page) || 1;
    const skip = (pageNum - 1) * limit;

    const totalCount = await Expense.countDocuments(queryFilter);
    const totalPages = Math.ceil(totalCount / limit);

    // 3. Fetch Paginated Transactions
    const expenses = await Expense.find(queryFilter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    // 4. Calculate Totals (Income vs Expenses)
    const allUserExpenses = await Expense.find({
      $or: [
        { userId: userIdFilter },
        { userId: { $exists: false } }
      ]
    });

    let totalIncome = 0;
    let totalExpense = 0;

    allUserExpenses.forEach(item => {
      const cat = (item.category || '').toLowerCase();
      const type = (item.type || '').toLowerCase();

      if (type === 'income' || cat === 'salary' || cat === 'pocket money' || cat === 'income') {
        totalIncome += Number(item.amount || 0);
      } else {
        totalExpense += Number(item.amount || 0);
      }
    });

    // 5. Render EJS with all data
    res.render('home', {
      expenses,
      totalIncome,
      totalExpense,
      currentPage: pageNum,
      totalPages: totalPages || 1,
      query: req.query || {},
      user: req.session.user
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).send("Server Error");
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

app.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.send('Email already exists');

    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash(password, salt);

    await User.create({ name, email, password: passHash });
    res.redirect('/login');
  } catch (err) {
    res.status(500).send('Signup Error');
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
app.get('/analytics', isAuth, async (req, res) => {
  try {
    const allData = await Expense.find();
    res.render('analytics', { expenses: allData, user: req.session.user });
  } catch (err) {
    res.status(500).send('Analytics page load error');
  }
});

// 7. Profile View Route
app.get('/profile', isAuth, async (req, res) => {
  try {
    const allData = await Expense.find();
    res.render('profile', { expenses: allData, user: req.session.user });
  } catch (err) {
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