const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/login');
};

router.get('/dashboard', isAuthenticated, expenseController.getDashboard);
router.post('/expense/add', isAuthenticated, expenseController.addExpense);
router.post('/expense/edit/:id', isAuthenticated, expenseController.editExpense);
router.post('/expense/delete/:id', isAuthenticated, expenseController.deleteExpense);

module.exports = router;