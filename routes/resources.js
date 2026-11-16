const express = require('express');
const Resource = require('../models/resource');
const wrap = require('./wrap');

const router = express.Router();

router.get('/', wrap(async (req, res) => {
  const filter = req.query.kind ? { kind: req.query.kind } : {};
  const resources = await Resource.find(filter).sort({ kind: 1, name: 1 });
  res.json(resources);
}));

module.exports = router;
