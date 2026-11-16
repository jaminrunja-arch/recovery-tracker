const express = require('express');
const ErrorLog = require('../models/errorlog');
const AppError = require('../errors/appError');
const catalog = require('../errors/catalog');
const summary = require('../errors/summary');
const validate = require('../validate');
const wrap = require('./wrap');

const router = express.Router();

router.get('/catalog', (req, res) => {
  res.json(catalog.entries);
});

router.get('/summary', wrap(async (req, res) => {
  const logs = await ErrorLog.find({ userId: req.userId });
  res.json(summary.build(logs, catalog.entries));
}));

router.get('/', wrap(async (req, res) => {
  const code = req.query.code;
  if (code !== undefined && (typeof code !== 'string' || !/^E\d{3}$/.test(code))) {
    throw new AppError('E901');
  }
  const filter = code ? { code: code, userId: req.userId } : { userId: req.userId };
  const logs = await ErrorLog.find(filter).sort({ createdAt: -1 }).limit(25);
  res.json(logs);
}));

router.post('/:id/resolve', wrap(async (req, res) => {
  const log = await ErrorLog.findOneAndUpdate({ _id: validate.readId(req.params.id), userId: req.userId }, { resolved: true }, { new: true });
  if (!log) {
    throw new AppError('E501');
  }
  res.json(log);
}));

router.delete('/resolved', wrap(async (req, res) => {
  const result = await ErrorLog.deleteMany({ resolved: true, userId: req.userId });
  res.json({ removed: result.deletedCount });
}));

module.exports = router;
