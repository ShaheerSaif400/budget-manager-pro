const { body, validationResult } = require('express-validator');

// 1. Register Form Rules
const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ min: 3 }).withMessage('Name must be at least 3 characters long.'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Please enter a valid email address.')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.')
];

// 2. Login Form Rules
const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Please enter a valid email address.'),
  
  body('password')
    .notEmpty().withMessage('Password cannot be empty.')
];

// 3. Transaction Form Rules
const transactionValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required.')
    .isLength({ min: 2 }).withMessage('Title must be at least 2 characters.'),
  
  body('amount')
    .notEmpty().withMessage('Amount is required.')
    .isNumeric().withMessage('Amount must be a valid number.')
    .custom(val => val > 0).withMessage('Amount must be greater than zero.'),
  
  body('category')
    .trim()
    .notEmpty().withMessage('Category is required.')
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error_msg', errors.array()[0].msg);
    return req.session.save(() => {
      const backUrl = req.get('Referrer') || '/';
      res.redirect(backUrl);
    });
  }
  next();
};
module.exports = {
  registerValidation,
  loginValidation,
  transactionValidation,
  validate
};