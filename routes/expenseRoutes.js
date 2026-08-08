const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { transactionValidation, validate } = require('../middleware/validator');

// Authentication Protection Middleware
const isAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
};

// Dashboard Route
router.get('/dashboard', isAuth, expenseController.getDashboard);

// Expense Transactions Actions with Validation
router.post('/add-expense', isAuth, transactionValidation, validate, expenseController.addExpense);
router.post('/expense/edit/:id', isAuth, transactionValidation, validate, expenseController.editExpense);
router.post('/expense/delete/:id', isAuth, expenseController.deleteExpense);

// Analytics & Profile Routes
router.get('/analytics', isAuth, expenseController.getAnalytics);
router.get('/profile', isAuth, expenseController.getProfile);

// Budget Management Routes
router.post('/budget/set', isAuth, expenseController.setBudget);
router.post('/budget/delete/:id', isAuth, expenseController.deleteBudget);

module.exports = router;