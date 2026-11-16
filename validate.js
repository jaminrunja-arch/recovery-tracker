const AppError = require('./errors/appError');

const idPattern = /^[0-9a-fA-F]{24}$/;

function readId(value) {
  if (typeof value !== 'string' || !idPattern.test(value)) {
    throw new AppError('E901');
  }
  return value;
}

function readNumber(value, min, max, code) {
  if (typeof value !== 'number' || !isFinite(value) || value < min || value > max) {
    throw new AppError(code);
  }
  return value;
}

function readText(value, max, code) {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value !== 'string' || value.length > max) {
    throw new AppError(code);
  }
  return value;
}

module.exports = {
  readId: readId,
  readNumber: readNumber,
  readText: readText
};
