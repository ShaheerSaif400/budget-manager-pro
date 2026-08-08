const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');

// Middleware to check if user is logged in for API calls
const isApiAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
};

// 1. GET /api/transactions - Fetch all transactions for logged in user
router.get('/transactions', isApiAuth, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const expenses = await Expense.find({
      $or: [{ userId: userId }, { userId: userId.toString() }]
    }).sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: expenses.length,
      data: expenses
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching transactions' });
  }
});

// 2. GET /api/dashboard/summary - Fetch financial calculations for logged in user
router.get('/dashboard/summary', isApiAuth, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const expenses = await Expense.find({
      $or: [{ userId: userId }, { userId: userId.toString() }]
    });

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryTotals = {};

    expenses.forEach(exp => {
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

    const netSavings = totalIncome - totalExpense;

    res.status(200).json({
      success: true,
      summary: {
        totalIncome,
        totalExpense,
        netSavings,
        categoryBreakdown: categoryTotals
      }
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching summary' });
  }
});

module.exports = router;