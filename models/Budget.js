const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: true
  },
  monthlyLimit: {
    type: Number,
    required: true
  },
  month: {
    type: String, // Format: "YYYY-MM" (e.g., "2026-08")
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Budget', budgetSchema);