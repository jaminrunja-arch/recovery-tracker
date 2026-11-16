const express = require('express');
const User = require('../models/user');
const AppError = require('../errors/appError');
const auth = require('../auth');
const limits = require('../limits');
const limiter = require('../limiter');
const wrap = require('./wrap');

const router = express.Router();
const attempts = limiter.create(limits.authMax, limits.rateWindowMs);
const dummyHash = 'a'.repeat(32) + ':' + 'b'.repeat(128);

function slowDown(req, res, next) {
  const result = attempts.hit(req.ip);
  if (!result.allowed) {
    res.set('Retry-After', String(result.retryAfter));
    return next(new AppError('E905'));
  }
  next();
}

function publicUser(user) {
  return { id: String(user._id), name: user.name, email: user.email };
}

function readEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('E602');
  }
  return email;
}

router.post('/register', slowDown, wrap(async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > limits.maxName) {
    throw new AppError('E601');
  }
  const email = readEmail(req.body.email);
  const password = req.body.password;
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    throw new AppError('E603');
  }
  if (await User.exists({ email: email })) {
    throw new AppError('E604');
  }
  const passwordHash = await auth.hashPassword(password);
  let user;
  try {
    user = await User.create({ name: name, email: email, passwordHash: passwordHash });
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError('E604');
    }
    throw err;
  }
  res.json({ token: auth.makeToken(user._id), user: publicUser(user) });
}));

router.post('/login', slowDown, wrap(async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = email ? await User.findOne({ email: email }) : null;
  const good = await auth.checkPassword(password, user ? user.passwordHash : dummyHash);
  if (!user || !good) {
    throw new AppError('E605');
  }
  res.json({ token: auth.makeToken(user._id), user: publicUser(user) });
}));

router.get('/me', auth.requireUser, wrap(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    throw new AppError('E606');
  }
  res.json({ user: publicUser(user) });
}));

module.exports = router;
