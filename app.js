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

// Middleware & View Engine Setup
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// Serve Public & Uploaded Files
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Multer Storage Configuration
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

// 2. DASHBOARD PAGE
app.get('/dashboard', isAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const userId = req.session.user._id;

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

// DELETE TRANSACTION ROUTE
app.post('/expense/delete/:id', async (req, res) => {
  try {
    const expenseId = req.params.id;
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

// EDIT TRANSACTION ROUTE
app.post('/expense/edit/:id', async (req, res) => {
  try {
    const expenseId = req.params.id;
    const { title, amount, category, type, date } = req.body;

    let formattedType = 'Expense';
    if (type && typeof type === 'string') {
      formattedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    }

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
      return res.status(403).send("Unauthorized action or item not found.");
    }

    res.redirect('/dashboard');
  } catch (err) {
    console.error("Edit Error:", err);
    res.status(500).send("Error updating transaction");
  }
});

// ================= BLOG SYSTEM ROUTES =================

const blogPosts = [
  {
    id: '1',
    title: 'The 50/30/20 Rule for Personal Finance',
    category: 'Budgeting',
    badgeColor: 'success',
    readTime: '5 min read',
    date: 'Jul 2026',
    image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
    summary: 'Learn how allocating 50% for needs, 30% for wants, and 20% for savings can transform your monthly budget balance.',
    content: `
      <p class="mb-4">Managing money effectively doesn't require a degree in finance. One of the simplest and most effective frameworks is the <strong>50/30/20 budget rule</strong>.</p>
      <h3 class="fw-bold text-dark mt-4 mb-3">1. 50% for Needs</h3>
      <p class="mb-4">Needs are expenses you cannot avoid. These include housing, utilities, groceries, transportation, and basic insurance. Exactly half of your after-tax income should cover these core essentials.</p>
      <h3 class="fw-bold text-dark mt-4 mb-3">2. 30% for Wants</h3>
      <p class="mb-4">Wants are items that aren't strictly necessary for survival but enhance your lifestyle—dining out, entertainment, hobbies, and vacation travel. Budgeting 30% allows you to enjoy life without financial guilt.</p>
      <h3 class="fw-bold text-dark mt-4 mb-3">3. 20% for Savings & Debt Repayment</h3>
      <p class="mb-4">The final 20% goes directly toward your future. Put this portion into emergency reserves, retirement accounts, or paying down high-interest debt.</p>
    `
  },
  {
    id: '2',
    title: '10 Simple Ways to Cut Monthly Expenses',
    category: 'Savings',
    badgeColor: 'primary',
    readTime: '4 min read',
    date: 'Jul 2026',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80',
    summary: 'Identify hidden cash leaks and unnecessary subscription charges to save more money every single month.',
    content: `
      <p class="mb-4">Small daily leaks can add up to a major drain on your finances. Cutting monthly expenses doesn't mean sacrificing your lifestyle entirely.</p>
      <h3 class="fw-bold text-dark mt-4 mb-3">Audit Unused Subscriptions</h3>
      <p class="mb-4">Review your bank statements for recurring subscriptions. Cancel streaming services, app memberships, or gym plans you rarely use.</p>
      <h3 class="fw-bold text-dark mt-4 mb-3">Cook at Home & Plan Meals</h3>
      <p class="mb-4">Dining out or ordering food delivery frequently is one of the quickest ways to blow a budget. Planning weekly meals drastically cuts down food costs.</p>
    `
  },
  {
    id: '3',
    title: 'Emergency Funds vs. Investments',
    category: 'Investing',
    badgeColor: 'warning',
    readTime: '6 min read',
    date: 'Jul 2026',
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80',
    summary: 'Why building a 3-month liquid cash reserve is required before jumping into stocks or crypto investments.',
    content: `
      <p class="mb-4">Before putting your hard-earned money into stock markets, real estate, or crypto, having a solid financial foundation is critical.</p>
      <h3 class="fw-bold text-dark mt-4 mb-3">Why an Emergency Fund Comes First</h3>
      <p class="mb-4">An emergency fund acts as financial insurance. It covers unexpected medical bills, car repairs, or sudden income loss without forcing you to sell investments at a loss.</p>
      <h3 class="fw-bold text-dark mt-4 mb-3">Transitioning to Long-Term Investments</h3>
      <p class="mb-4">Once you have 3 to 6 months of living expenses safely stored in an accessible savings account, you can confidently invest excess capital into growth assets.</p>
    `
  }
];

// GET: All Blogs Route
app.get('/blogs', (req, res) => {
  res.render('blogs', { 
    blogs: blogPosts, 
    user: req.session.user || null 
  });
});

// GET: Single Blog Detail Route
app.get('/blogs/:id', (req, res) => {
  const blogId = req.params.id;
  const blog = blogPosts.find(b => b.id === blogId);

  if (!blog) {
    return res.status(404).send('Blog article not found.');
  }

  res.render('blog-detail', { 
    blog, 
    user: req.session.user || null 
  });
});

// ================= AUTHENTICATION & OTHER ROUTES =================

app.get('/login', (req, res) => {
  res.render('login', { user: req.session.user || null });
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
  res.render('signup', { user: req.session.user || null });
});

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

app.post('/add-expense', isAuth, async (req, res) => {
  try {
    let { type, title, amount, category } = req.body;

    if (type) {
      type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    }

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
    res.redirect('/dashboard');
  }
});

app.get('/analytics', isAuth, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const userExpenses = await Expense.find({
      $or: [{ userId: userId }, { userId: userId.toString() }]
    });

    res.render('analytics', { expenses: userExpenses, user: req.session.user });
  } catch (err) {
    console.error("Analytics Fetch Error:", err);
    res.status(500).send('Analytics page load error');
  }
});

app.get('/profile', isAuth, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const userExpenses = await Expense.find({
      $or: [{ userId: userId }, { userId: userId.toString() }]
    });

    res.render('profile', { expenses: userExpenses, user: req.session.user });
  } catch (err) {
    console.error("Profile Fetch Error:", err);
    res.status(500).send('Profile Error');
  }
});

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

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});