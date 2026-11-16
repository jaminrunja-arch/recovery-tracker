const express = require('express');
const Goal = require('../models/goal');
const CheckIn = require('../models/checkin');
const Habit = require('../models/habit');
const AppError = require('../errors/appError');
const limits = require('../limits');
const cache = require('../cache');
const lock = require('../lock');
const streak = require('../streak');
const validate = require('../validate');
const wrap = require('./wrap');

const router = express.Router();

const defaultHabits = [
  'Go for a walk',
  'Call a friend',
  'Drink a glass of water',
  'Write in a journal',
  'Do a breathing exercise'
];

function readCost(value) {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  const cost = Number(value);
  if (isNaN(cost) || cost < 0 || cost > 1000) {
    throw new AppError('E104');
  }
  return cost;
}

async function buildDashboard(userId, today) {
  const goals = await Goal.find({ userId: userId }).sort({ startDate: -1 });
  const ids = goals.map(function(g) {
    return g._id;
  });
  const checkins = await CheckIn.find({ goalId: { $in: ids } }).select('goalId date mood craving trigger').lean();
  const byGoal = {};
  checkins.forEach(function(c) {
    const key = String(c.goalId);
    byGoal[key] = byGoal[key] || [];
    byGoal[key].push(c);
  });
  return goals.map(function(goal) {
    const data = goal.toObject();
    data.summary = streak.summary(goal, byGoal[String(goal._id)] || [], today);
    return data;
  });
}

router.get('/', wrap(async (req, res) => {
  const today = streak.parseDay(req.query.today) || new Date();
  const key = req.userId + ':' + today.toISOString().slice(0, 10);
  res.json(await cache.get(key, function() {
    return buildDashboard(req.userId, today);
  }));
}));

router.post('/', wrap(async (req, res) => {
  const substance = typeof req.body.substance === 'string' ? req.body.substance.trim() : '';
  if (!substance) {
    throw new AppError('E101');
  }
  if (substance.length > limits.maxName) {
    throw new AppError('E109');
  }
  const startDate = streak.parseDay(req.body.startDate);
  if (!startDate) {
    throw new AppError('E102');
  }
  if (startDate < limits.earliestStart) {
    throw new AppError('E110');
  }
  if (streak.isFuture(startDate, new Date())) {
    throw new AppError('E103');
  }
  const costPerDay = readCost(req.body.costPerDay);
  const notes = validate.readText(req.body.notes, limits.maxNotes, 'E108');
  const goal = await lock.run('goals:' + req.userId, async function() {
    if (await Goal.countDocuments({ userId: req.userId }) >= limits.maxGoals) {
      throw new AppError('E107');
    }
    return Goal.create({
      userId: req.userId,
      substance: substance,
      startDate: startDate,
      costPerDay: costPerDay,
      notes: notes
    });
  });
  cache.bump();
  const habits = defaultHabits.map(function(name) {
    return { goalId: goal._id, name: name };
  });
  await Habit.insertMany(habits);
  res.json(goal);
}));

router.post('/:id/relapse', wrap(async (req, res) => {
  const id = validate.readId(req.params.id);
  const goal = await lock.run('goal:' + id, async function() {
    const found = await Goal.findOne({ _id: id, userId: req.userId });
    if (!found) {
      throw new AppError('E105');
    }
    const date = streak.parseDay(req.body.date);
    if (!date) {
      throw new AppError('E301');
    }
    if (date < found.startDate) {
      throw new AppError('E302');
    }
    if (streak.isFuture(date, new Date())) {
      throw new AppError('E303');
    }
    if (found.relapses.length >= limits.maxRelapses) {
      throw new AppError('E304');
    }
    found.relapses.push({ date: date, note: validate.readText(req.body.note, limits.maxNotes, 'E108') });
    await found.save();
    return found;
  });
  cache.bump();
  res.json(goal);
}));

router.delete('/:id', wrap(async (req, res) => {
  const id = validate.readId(req.params.id);
  const removed = await Goal.findOneAndDelete({ _id: id, userId: req.userId });
  if (!removed) {
    throw new AppError('E105');
  }
  await CheckIn.deleteMany({ goalId: id });
  await Habit.deleteMany({ goalId: id });
  cache.bump();
  res.json({ deleted: true });
}));

module.exports = router;
