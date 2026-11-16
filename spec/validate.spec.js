const validate = require('../validate');

function codeOf(fn) {
  try {
    fn();
  } catch (err) {
    return err.code;
  }
  return null;
}

describe('readId', function() {
  it('accepts a 24 character hex string', function() {
    expect(validate.readId('64b7f0f0f0f0f0f0f0f0f0f0')).toBe('64b7f0f0f0f0f0f0f0f0f0f0');
  });

  it('rejects short text, bad characters and non-strings', function() {
    expect(codeOf(function() { validate.readId('abc'); })).toBe('E901');
    expect(codeOf(function() { validate.readId('zzzzzzzzzzzzzzzzzzzzzzzz'); })).toBe('E901');
    expect(codeOf(function() { validate.readId(undefined); })).toBe('E901');
    expect(codeOf(function() { validate.readId(123); })).toBe('E901');
  });

  it('rejects objects and arrays used for operator injection', function() {
    expect(codeOf(function() { validate.readId({ $ne: '64b7f0f0f0f0f0f0f0f0f0f0' }); })).toBe('E901');
    expect(codeOf(function() { validate.readId(['64b7f0f0f0f0f0f0f0f0f0f0']); })).toBe('E901');
  });
});

describe('readNumber', function() {
  it('accepts numbers inside the range, including the edges', function() {
    expect(validate.readNumber(3, 1, 5, 'E204')).toBe(3);
    expect(validate.readNumber(1, 1, 5, 'E204')).toBe(1);
    expect(validate.readNumber(5, 1, 5, 'E204')).toBe(5);
  });

  it('rejects numbers outside the range', function() {
    expect(codeOf(function() { validate.readNumber(0, 1, 5, 'E204'); })).toBe('E204');
    expect(codeOf(function() { validate.readNumber(6, 1, 5, 'E204'); })).toBe('E204');
  });

  it('rejects anything that is not a real number', function() {
    [true, '3', [3], { a: 1 }, null, undefined, NaN, Infinity].forEach(function(value) {
      expect(codeOf(function() { validate.readNumber(value, 0, 10, 'E205'); })).toBe('E205');
    });
  });
});

describe('readText', function() {
  it('turns a missing value into an empty string', function() {
    expect(validate.readText(undefined, 10, 'E108')).toBe('');
    expect(validate.readText(null, 10, 'E108')).toBe('');
  });

  it('accepts text up to the limit', function() {
    expect(validate.readText('abcde', 5, 'E108')).toBe('abcde');
  });

  it('rejects text over the limit and values that are not text', function() {
    expect(codeOf(function() { validate.readText('abcdef', 5, 'E108'); })).toBe('E108');
    expect(codeOf(function() { validate.readText({ a: 1 }, 5, 'E108'); })).toBe('E108');
    expect(codeOf(function() { validate.readText(12, 5, 'E108'); })).toBe('E108');
  });
});
