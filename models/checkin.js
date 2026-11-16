const mongoose = require('mongoose');
const limits = require('../limits');

const checkInSchema = new mongoose.Schema({
  goalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', required: [true, 'Choose a goal'] },
  date: { type: Date, required: [true, 'Choose a date'] },
  mood: { type: Number, required: [true, 'Choose a mood'], min: [1, 'Mood must be between 1 and 5'], max: [5, 'Mood must be between 1 and 5'] },
  craving: { type: Number, required: [true, 'Set a craving level'], min: [0, 'Craving must be between 0 and 10'], max: [10, 'Craving must be between 0 and 10'] },
  trigger: { type: String, enum: [''].concat(limits.triggers) },
  note: { type: String, maxlength: limits.maxNote }
});

checkInSchema.index({ goalId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('CheckIn', checkInSchema, 'checkins');
