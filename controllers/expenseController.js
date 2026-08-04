const Expense = require('../models/Expense');
const User = require('../models/User');

// GET: Dashboard Page with Search, Pagination & Category Calculation
exports.getDashboard = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const userId = req.session.user._id;

    // Fetch all user expenses for totals/chart calculations
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

    // Filtering & Pagination Query
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
    res.status(500).send("Server Error loading dashboard");
  }
};

// POST: Add New Expense / Income
exports.addExpense = async (req, res) => {
  try {
    let { type, title, amount, category } = req.body;

    if (type) {
      type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    }

    await Expense.create({
      userId: req.session.user._id,
      type: type || 'Expense',
      title,
      amount: Number(amount) || 0,
      category,
      date: new Date()
    });

    res.redirect('/dashboard');
  } catch (err) {
    console.error("Save Expense Error:", err);
    res.redirect('/dashboard');
  }
};

// POST: Edit Existing Transaction
exports.editExpense = async (req, res) => {
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
      return res.status(403).send("Unauthorized action or item not found.");
    }

    res.redirect('/dashboard');
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).send("Error deleting transaction");
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
    res.redirect('/profile');
  } catch (err) {
    console.error("Profile Update Error:", err);
    res.status(500).send('Profile update error');
  }
};