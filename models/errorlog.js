const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
  code: { type: String, required: true },
  status: { type: Number, required: true },
  message: { type: String, required: true },
  method: String,
  path: String,
  detail: String,
  userId: { type: mongoose.Schema.Types.ObjectId, index: true },
  resolved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ErrorLog', errorLogSchema, 'errorlogs');
