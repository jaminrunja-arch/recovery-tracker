const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
  goalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', required: true },
  name: { type: String, required: [true, 'Enter a habit name'], trim: true, maxlength: [60, 'Habit name is too long'] },
  timesUsed: { type: Number, default: 0 },
  lastUsed: Date
});

module.exports = mongoose.model('Habit', habitSchema, 'habits');
