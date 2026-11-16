const mongoose = require('mongoose');
const limits = require('../limits');

const relapseSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  note: { type: String, maxlength: limits.maxNotes }
});

const goalSchema = new mongoose.Schema({
  substance: { type: String, required: true, trim: true, maxlength: limits.maxName },
  startDate: { type: Date, required: true },
  costPerDay: { type: Number, default: 0, min: 0, max: 1000 },
  notes: { type: String, maxlength: limits.maxNotes },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  relapses: [relapseSchema]
});

module.exports = mongoose.model('Goal', goalSchema, 'goals');
