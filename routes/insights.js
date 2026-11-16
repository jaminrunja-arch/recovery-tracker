const express = require('express');
const CheckIn = require('../models/checkin');
const AppError = require('../errors/appError');
const insights = require('../insights');
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
  res.json({
    consistency: insights.consistency(checkins, today, 14),
    triggers: insights.triggerBreakdown(checkins),
    peak: insights.peakCraving(checkins, today, 14),
    totalCheckIns: checkins.length
  });
}));

module.exports = router;
