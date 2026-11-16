const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  kind: { type: String, enum: ['hotline', 'group'], required: true },
  phone: String,
  url: String,
  info: String
});

module.exports = mongoose.model('Resource', resourceSchema, 'resources');
