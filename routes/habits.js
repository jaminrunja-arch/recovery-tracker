const express = require('express');
const Habit = require('../models/habit');
const Goal = require('../models/goal');
const AppError = require('../errors/appError');
const limits = require('../limits');
const lock = require('../lock');
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
  const habits = await Habit.find({ goalId: goalId }).sort({ timesUsed: -1, name: 1 });
  res.json(habits);
}));

router.post('/', wrap(async (req, res) => {
  if (!req.body.goalId) {
    throw new AppError('E106');
  }
  const goalId = validate.readId(req.body.goalId);
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    throw new AppError('E401');
  }
  if (name.length > limits.maxName) {
    throw new AppError('E402');
  }
  await owned.goalFor(req.userId, goalId);
  const habit = await lock.run('habits:' + goalId, async function() {
    if (await Habit.countDocuments({ goalId: goalId }) >= limits.maxHabits) {
      throw new AppError('E404');
    }
    return Habit.create({ goalId: goalId, name: name });
  });
  res.json(habit);
}));

router.post('/:id/use', wrap(async (req, res) => {
  const id = validate.readId(req.params.id);
  const existing = await Habit.findById(id);
  if (!existing || !await Goal.exists({ _id: existing.goalId, userId: req.userId })) {
    throw new AppError('E403');
  }
  const habit = await lock.run('habit:' + id, function() {
    return Habit.findByIdAndUpdate(
      id,
      { $inc: { timesUsed: 1 }, $set: { lastUsed: new Date() } },
      { new: true }
    );
  });
  if (!habit) {
    throw new AppError('E403');
  }
  res.json(habit);
}));

router.delete('/:id', wrap(async (req, res) => {
  const existing = await Habit.findById(validate.readId(req.params.id));
  if (!existing || !await Goal.exists({ _id: existing.goalId, userId: req.userId })) {
    throw new AppError('E403');
  }
  await Habit.findByIdAndDelete(existing._id);
  res.json({ deleted: true });
}));

module.exports = router;
