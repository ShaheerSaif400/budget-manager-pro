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


//ROUTES


// 1. HOME / LANDING PAGE (Guest aur Logged-in dono ke liye - landing.ejs render hoga)
app.get('/', (req, res) => {
  res.render('landing', { user: req.session.user || null });
});

// 2. DASHBOARD PAGE (Sirf Logged-in Users ke liye - home.ejs render hoga)
app.get('/dashboard', isAuth, async (req, res) => {
  try {
    const data = await Expense.find().sort({ date: -1 });
    res.render('home', { expenses: data, user: req.session.user });
  } catch (err) {
    console.log(err);
    res.status(500).send('Server Error');
  }
});

// 3. Financial Blog Page (Public + Logged-in)
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

// 5. Expense Transactions Route
app.post('/add-expense', isAuth, async (req, res) => {
  try {
    const { type, title, amount, category } = req.body;
    await Expense.create({ type, title, amount, category });
    res.redirect('/dashboard');
  } catch (err) {
    res.status(500).send('Error saving transaction');
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

// 8. Profile Update Route (File Upload + Preset Avatar Handling)
app.post('/profile/update', isAuth, upload.single('avatarFile'), async (req, res) => {
  try {
    const { name, email, avatarUrl } = req.body;
    let finalAvatar = req.session.user.avatar || '';

    // Priority 1: Agar user ne device se local picture upload ki
    if (req.file) {
      finalAvatar = '/uploads/' + req.file.filename;
    } 
    // Priority 2: Agar user ne built-in avatar select kiya ya image link paste kiya
    else if (avatarUrl && avatarUrl.trim() !== '') {
      finalAvatar = avatarUrl;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.session.user._id,
      { name, email, avatar: finalAvatar },
      { new: true }
    );

    req.session.user = updatedUser; // Update active session
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