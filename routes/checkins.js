const express = require('express');
const CheckIn = require('../models/checkin');
const AppError = require('../errors/appError');
const limits = require('../limits');
const cache = require('../cache');
const lock = require('../lock');
const streak = require('../streak');
const validate = require('../validate');
const owned = require('./owned');
const wrap = require('./wrap');

const router = express.Router();

router.get('/', wrap(async (req, res) => {
  if (!req.query.goalId) {
    throw new AppError('E106');
  }
  const goal = await owned.goalFor(req.userId, req.query.goalId);
  const goalId = goal._id;
  const items = await CheckIn.find({ goalId: goalId }).sort({ date: -1 }).limit(14);
  res.json(items);
}));

router.post('/', wrap(async (req, res) => {
  if (!req.body.goalId) {
    throw new AppError('E106');
  }
  const goalId = validate.readId(req.body.goalId);
  const date = streak.parseDay(req.body.date);
  if (!date) {
    throw new AppError('E201');
  }
  if (streak.isFuture(date, new Date())) {
    throw new AppError('E202');
  }
  const mood = validate.readNumber(req.body.mood, 1, 5, 'E204');
  const craving = validate.readNumber(req.body.craving, 0, 10, 'E205');
  const trigger = req.body.trigger === undefined || req.body.trigger === null ? '' : req.body.trigger;
  if (typeof trigger !== 'string' || (trigger !== '' && limits.triggers.indexOf(trigger) === -1)) {
    throw new AppError('E207');
  }
  const note = validate.readText(req.body.note, limits.maxNote, 'E206');
  await owned.goalFor(req.userId, goalId);
  const item = await lock.run('checkin:' + goalId + ':' + date.toISOString(), async function() {
    if (await CheckIn.findOne({ goalId: goalId, date: date })) {
      throw new AppError('E203');
    }
    return CheckIn.create({ goalId: goalId, date: date, mood: mood, craving: craving, trigger: trigger, note: note });
  });
  cache.bump();
  res.json(item);
}));

module.exports = router;
