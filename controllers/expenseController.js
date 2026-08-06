const Expense = require('../models/Expense');
const User = require('../models/User');
const Budget = require('../models/Budget');

// GET: Dashboard Page with Search, Pagination & Category Calculation
exports.getDashboard = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const userId = req.session.user._id;

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

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

    const userBudgets = await Budget.find({ userId, month: currentMonthStr });

    const budgetOverview = userBudgets.map(b => {
      const spent = categoryTotals[b.category] || 0;
      const percentage = Math.min(Math.round((spent / b.monthlyLimit) * 100), 100);
      const isOver = spent > b.monthlyLimit;

      return {
        _id: b._id,
        category: b.category,
        monthlyLimit: b.monthlyLimit,
        spent,
        percentage,
        isOver
      };
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
      categoryChartData: JSON.stringify(categoryTotals),
      budgets: budgetOverview
    });

  } catch (err) {
    console.error("Dashboard Fetch Error:", err);
    res.status(500).send("Server Error loading dashboard");
  }
};

// POST: Add New Expense / Income
exports.addExpense = async (req, res) => {
  try {
    let { type, title, amount, category, customCategory } = req.body;

    if (type) {
      type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    }

    if (category === 'Other' && customCategory && customCategory.trim() !== '') {
      category = customCategory.trim();
    }

    await Expense.create({
      userId: req.session.user._id,
      type: type || 'Expense',
      title,
      amount: Number(amount) || 0,
      category,
      date: new Date()
    });

    req.flash('success_msg', 'Transaction added successfully');
    res.redirect('/dashboard');
  } catch (err) {
    console.error("Save Expense Error:", err);
    req.flash('error_msg', 'Failed to add transaction');
    res.redirect('/dashboard');
  }
};

// POST: Edit / Update Expense
exports.editExpense = async (req, res) => {
  try {
    const { id } = req.params;
    let { title, amount, type, category, customCategory, date } = req.body;

    if (category === 'Other' && customCategory && customCategory.trim() !== '') {
      category = customCategory.trim();
    }

    await Expense.findByIdAndUpdate(id, {
      title,
      amount: Number(amount) || 0,
      type,
      category,
      date: date ? new Date(date) : new Date()
    });

    req.flash('success_msg', 'Transaction updated successfully');
    res.redirect('/dashboard');
  } catch (err) {
    console.error("Edit Expense Error:", err);
    req.flash('error_msg', 'Failed to update transaction');
    res.redirect('/dashboard');
  }
};

// POST: Delete Transaction
exports.deleteExpense = async (req, res) => {
  try {
    const expenseId = req.params.id;
    const deletedExpense = await Expense.findOneAndDelete({
      _id: expenseId,
      userId: req.session.user._id
    });

    if (!deletedExpense) {
      req.flash('error_msg', 'Unauthorized action or item not found');
      return res.redirect('/dashboard');
    }

    req.flash('success_msg', 'Transaction deleted successfully');
    res.redirect('/dashboard');
  } catch (err) {
    console.error("Delete Error:", err);
    req.flash('error_msg', 'Error deleting transaction');
    res.redirect('/dashboard');
  }
};

// GET: Analytics Page
exports.getAnalytics = async (req, res) => {
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
};

// GET: Profile View
exports.getProfile = async (req, res) => {
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
};

// POST: Update Profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, avatarUrl } = req.body;
    let finalAvatar = req.session.user.avatar || '';

    if (req.file) {
      finalAvatar = '/uploads/' + req.file.filename;
    } else if (avatarUrl && avatarUrl.trim() !== '') {
      finalAvatar = avatarUrl;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.session.user._id,
      { name, email, avatar: finalAvatar },
      { new: true }
    );

    req.session.user = updatedUser;
    req.flash('success_msg', 'Profile updated successfully');
    res.redirect('/profile');
  } catch (err) {
    console.error("Profile Update Error:", err);
    res.status(500).send('Profile update error');
  }
};

// POST: Set or Update Monthly Budget for a Category
exports.setBudget = async (req, res) => {
  try {
    let { category, customCategory, monthlyLimit } = req.body;
    const userId = req.session.user._id;

    if (category === 'Other' && customCategory && customCategory.trim() !== '') {
      category = customCategory.trim();
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await Budget.findOneAndUpdate(
      { userId, category, month: currentMonth },
      { monthlyLimit: Number(monthlyLimit) },
      { upsert: true, new: true }
    );

    req.flash('success_msg', 'Budget saved successfully');
    res.redirect('/dashboard');
  } catch (err) {
    console.error("Set Budget Error:", err);
    req.flash('error_msg', 'Error saving budget');
    res.redirect('/dashboard');
  }
};

// POST: Delete Budget
exports.deleteBudget = async (req, res) => {
  try {
    const budgetId = req.params.id;
    await Budget.findOneAndDelete({ _id: budgetId, userId: req.session.user._id });
    req.flash('success_msg', 'Budget deleted successfully');
    res.redirect('/dashboard');
  } catch (err) {
    console.error("Delete Budget Error:", err);
    req.flash('error_msg', 'Error deleting budget');
    res.redirect('/dashboard');
  }
};