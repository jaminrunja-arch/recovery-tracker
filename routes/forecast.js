const express = require('express');
const CheckIn = require('../models/checkin');
const Habit = require('../models/habit');
const AppError = require('../errors/appError');
const forecast = require('../forecast');
const streak = require('../streak');
const owned = require('./owned');
const wrap = require('./wrap');

const router = express.Router();

router.get('/', wrap(async (req, res) => {
  if (!req.query.goalId) {
    throw new AppError('E106');
  }
  const goal = await owned.goalFor(req.userId, req.query.goalId);
  const today = streak.parseDay(req.query.today) || new Date();
  const checkins = await CheckIn.find({ goalId: goal._id });
  const habits = await Habit.find({ goalId: goal._id });
  res.json({
    days: forecast.forecast(checkins, today, 7),
    plan: forecast.plan(habits),
    minSamples: forecast.minSamples,
    totalCheckIns: checkins.length
  });
}));

module.exports = router;
