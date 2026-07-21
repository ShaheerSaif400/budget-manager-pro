const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title']
  },
  amount: {
    type: Number,
    required: [true, 'Please add an amount']
  },
  type: {
    type: String,
    required: true,
    enum: ['Income', 'Expense'] // Ab system ko pata hoga ke paise aaye hain ya gaye hain
  },
  // Baki code wesa hi rahega, sirf category ke enum ko update karein:
category: {
  type: String,
  required: [true, 'Please select a category'],
  enum: [
    // Income Categories
    'Salary', 'Freelancing', 'Pocket Money', 'Investments', 'Grants/Gifts', 
    // Expense Categories
    'Food', 'Rent', 'Entertainment', 'Bills', 'Shopping', 'Medical', 'Travel', 'Other'
  ]
},
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Expense', TransactionSchema);