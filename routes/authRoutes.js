const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const authController = require('../controllers/authController');
const expenseController = require('../controllers/expenseController');
const { registerValidation, loginValidation, validate } = require('../middleware/validator');

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

const isAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
};

// Landing Page
router.get('/', authController.getLanding);

// Auth View & Action Routes with Validation
router.get('/login', authController.getLogin);
router.post('/login', loginValidation, validate, authController.postLogin);

router.get('/signup', authController.getSignup);
router.get('/register', authController.getSignup);
router.post('/signup', upload.single('avatar'), registerValidation, validate, authController.postSignup);

router.get('/logout', authController.logout);

// Blog Routes
router.get('/blogs', authController.getBlogs);
router.get('/blogs/:id', authController.getBlogById);

// Profile Update Route (with file upload)
router.post('/profile/update', isAuth, upload.single('avatarFile'), expenseController.updateProfile);

module.exports = router;