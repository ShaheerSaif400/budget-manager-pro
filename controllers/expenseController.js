const Expense = require('../models/Expense');

exports.getDashboard = async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.session.userId }).sort({ date: -1 });
    
    // Calculate Analytics Totals
    let totalIncome = 0;
    let totalSpent = 0;

    expenses.forEach(exp => {
      if (exp.type === 'Income') totalIncome += exp.amount;
      else totalSpent += exp.amount;
    });

    const netSavings = totalIncome - totalSpent;

    res.render('home', {
      user: req.session.user,
      expenses,
      totalIncome,
      totalSpent,
      netSavings
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error loading dashboard");
  }
};

exports.addExpense = async (req, res) => {
  try {
    const { title, amount, category, type, date } = req.body;
    let formattedType = type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : 'Expense';

    await Expense.create({
      title,
      amount: Number(amount) || 0,
      category,
      type: formattedType,
      date: date ? new Date(date) : new Date(),
      userId: req.session.userId
    });

    res.redirect('/dashboard');
  } catch (err) {
    console.error("Add Error:", err);
    res.status(500).send("Error creating transaction");
  }
};

exports.editExpense = async (req, res) => {
  try {
    const expenseId = req.params.id;
    const { title, amount, category, type, date } = req.body;

    let formattedType = type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : 'Expense';

    const updated = await Expense.findOneAndUpdate(
      { _id: expenseId, userId: req.session.userId },
      {
        title,
        amount: Number(amount) || 0,
        category,
        type: formattedType,
        date: date ? new Date(date) : new Date()
      },
      { new: true }
    );

    if (!updated) return res.status(403).send("Unauthorized action");

    res.redirect('/dashboard');
  } catch (err) {
    console.error("Edit Error:", err);
    res.status(500).send("Error updating transaction");
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const expenseId = req.params.id;
    const deleted = await Expense.findOneAndDelete({
      _id: expenseId,
      userId: req.session.userId
    });

    if (!deleted) return res.status(403).send("Unauthorized action");

    res.redirect('/dashboard');
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).send("Error deleting transaction");
  }
};