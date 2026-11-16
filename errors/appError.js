const catalog = require('./catalog');

class AppError extends Error {
  constructor(code) {
    const entry = catalog.find(code);
    super(entry.message);
    this.code = entry.code;
    this.status = entry.status;
  }
}

module.exports = AppError;
