const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');

// Authentication Protection Middleware
const isAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
};

// Dashboard Route
router.get('/dashboard', isAuth, expenseController.getDashboard);

// Expense Transactions Actions
router.post('/add-expense', isAuth, expenseController.addExpense);
router.post('/expense/edit/:id', isAuth, expenseController.editExpense);
router.post('/expense/delete/:id', isAuth, expenseController.deleteExpense);

// Analytics & Profile Routes
router.get('/analytics', isAuth, expenseController.getAnalytics);
router.get('/profile', isAuth, expenseController.getProfile);

module.exports = router;