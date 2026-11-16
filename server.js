const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const seedResources = require('./seed');
const ErrorLog = require('./models/errorlog');
const CheckIn = require('./models/checkin');
const User = require('./models/user');
const AppError = require('./errors/appError');
const catalog = require('./errors/catalog');
const classify = require('./errors/classify');
const registry = require('./errors/registry');
const limits = require('./limits');
const limiter = require('./limiter');
const securityHeaders = require('./headers');
const auth = require('./auth');

const app = express();
const limit = limiter.create(Number(process.env.RATE_LIMIT_MAX) || limits.rateMax, limits.rateWindowMs);

app.disable('x-powered-by');
app.use(securityHeaders);

app.use('/api', (req, res, next) => {
  const result = limit.hit(req.ip);
  if (!result.allowed) {
    res.set('Retry-After', String(result.retryAfter));
    return next(new AppError('E905'));
  }
  next();
});

app.use(express.json({ limit: limits.bodyLimit }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/bootstrap', express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));
app.use('/vendor/angular', express.static(path.join(__dirname, 'node_modules/angular')));

app.use('/api', (req, res, next) => {
  next(mongoose.connection.readyState === 1 ? undefined : new AppError('E906'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: 'connected' });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/resources', require('./routes/resources'));
app.use('/api/goals', auth.requireUser, require('./routes/goals'));
app.use('/api/checkins', auth.requireUser, require('./routes/checkins'));
app.use('/api/habits', auth.requireUser, require('./routes/habits'));
app.use('/api/insights', auth.requireUser, require('./routes/insights'));
app.use('/api/errors', auth.requireUser, require('./routes/errors'));
app.use('/api/forecast', auth.requireUser, require('./routes/forecast'));

app.use('/api', (req, res, next) => {
  next(new AppError('E902'));
});

app.use(async (err, req, res, next) => {
  const code = err instanceof AppError ? err.code : classify(err);
  const entry = catalog.find(code);
  if (req.userId && entry.code !== 'E905' && entry.code !== 'E906') {
    try {
      await registry.record(ErrorLog, {
        userId: req.userId,
        code: entry.code,
        status: entry.status,
        message: entry.message,
        method: req.method,
        path: req.originalUrl.split('?')[0].slice(0, 200),
        detail: entry.code === 'E999' ? err.message : ''
      }, limits.errorLogCap);
    } catch (logError) {
      console.log(logError.message);
    }
  }
  res.status(entry.status).json({ error: entry.message, code: entry.code });
});

process.on('unhandledRejection', reason => {
  console.log('Unhandled rejection:', reason && reason.message);
});

const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/recovery_tracker';
const port = process.env.PORT || 3000;

mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 4000, heartbeatFrequencyMS: 2000 })
  .then(() => User.init().catch(err => console.log('Could not build the user index:', err.message)))
  .then(() => CheckIn.init().catch(err => console.log('Could not build the check-in index:', err.message)))
  .then(() => seedResources())
  .then(() => {
    app.listen(port, () => console.log('Recovery Tracker is running at http://localhost:' + port));
  })
  .catch(err => {
    console.log('Could not connect to MongoDB at ' + mongoUrl);
    console.log('Start MongoDB, or run "docker compose up" instead. Details: ' + err.message);
    process.exit(1);
  });
