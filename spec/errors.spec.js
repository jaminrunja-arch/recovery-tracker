const catalog = require('../errors/catalog');
const AppError = require('../errors/appError');
const classify = require('../errors/classify');
const summary = require('../errors/summary');

describe('error catalog', function() {
  it('uses codes that start with E and have three digits', function() {
    catalog.entries.forEach(function(e) {
      expect(e.code).toMatch(/^E\d{3}$/);
    });
  });

  it('has no duplicate codes', function() {
    const codes = catalog.entries.map(function(e) {
      return e.code;
    });
    const unique = codes.filter(function(c, i) {
      return codes.indexOf(c) === i;
    });
    expect(unique.length).toBe(codes.length);
  });

  it('gives every entry a known status, an area and a message', function() {
    catalog.entries.forEach(function(e) {
      expect([400, 401, 404, 409, 413, 429, 500, 503]).toContain(e.status);
      expect(e.area.length).toBeGreaterThan(0);
      expect(e.message.length).toBeGreaterThan(0);
    });
  });

  it('keeps the unexpected error as the last entry', function() {
    const last = catalog.entries[catalog.entries.length - 1];
    expect(last.code).toBe('E999');
    expect(last.status).toBe(500);
  });

  it('finds an entry by code', function() {
    expect(catalog.find('E203').message).toBe('You already checked in for that day');
  });

  it('falls back to the unexpected error for an unknown code', function() {
    expect(catalog.find('E000').code).toBe('E999');
  });
});

describe('AppError', function() {
  it('carries the code, status and message from the catalog', function() {
    const err = new AppError('E203');
    expect(err.code).toBe('E203');
    expect(err.status).toBe(409);
    expect(err.message).toBe('You already checked in for that day');
  });

  it('is a real Error', function() {
    expect(new AppError('E101') instanceof Error).toBe(true);
  });

  it('uses the unexpected error for an unknown code', function() {
    const err = new AppError('E000');
    expect(err.code).toBe('E999');
    expect(err.status).toBe(500);
  });
});

describe('classify', function() {
  function validation(path, kind) {
    const errors = {};
    errors[path] = { path: path, kind: kind };
    return { name: 'ValidationError', errors: errors };
  }

  it('maps goal fields', function() {
    expect(classify(validation('substance', 'required'))).toBe('E101');
    expect(classify(validation('startDate', 'required'))).toBe('E102');
    expect(classify(validation('costPerDay', 'max'))).toBe('E104');
    expect(classify(validation('goalId', 'required'))).toBe('E106');
  });

  it('maps check-in fields', function() {
    expect(classify(validation('date', 'required'))).toBe('E201');
    expect(classify(validation('mood', 'min'))).toBe('E204');
    expect(classify(validation('craving', 'max'))).toBe('E205');
  });

  it('maps habit names', function() {
    expect(classify(validation('name', 'required'))).toBe('E401');
    expect(classify(validation('name', 'maxlength'))).toBe('E402');
  });

  it('uses the unexpected error for a field it does not know', function() {
    expect(classify(validation('color', 'required'))).toBe('E999');
  });

  it('maps a cast error to invalid id', function() {
    expect(classify({ name: 'CastError' })).toBe('E901');
  });

  it('maps a bad JSON body', function() {
    expect(classify({ type: 'entity.parse.failed' })).toBe('E903');
  });

  it('maps anything else to the unexpected error', function() {
    expect(classify(new Error('boom'))).toBe('E999');
  });
});

describe('registry summary', function() {
  const logs = [
    { code: 'E203', resolved: false, createdAt: '2026-10-25T10:00:00Z' },
    { code: 'E203', resolved: true, createdAt: '2026-10-25T12:00:00Z' },
    { code: 'E101', resolved: false, createdAt: '2026-10-25T09:00:00Z' },
    { code: 'E101', resolved: false, createdAt: '2026-10-25T09:30:00Z' },
    { code: 'E101', resolved: false, createdAt: '2026-10-25T09:45:00Z' }
  ];

  it('counts the totals', function() {
    const result = summary.build(logs, catalog.entries);
    expect(result.totalLogged).toBe(5);
    expect(result.totalOpen).toBe(4);
    expect(result.codesInCatalog).toBe(catalog.entries.length);
  });

  it('lists only seen codes, most frequent first', function() {
    const result = summary.build(logs, catalog.entries);
    expect(result.codes.length).toBe(2);
    expect(result.codes[0].code).toBe('E101');
    expect(result.codes[0].count).toBe(3);
    expect(result.codes[1].code).toBe('E203');
  });

  it('counts open entries and finds the last time seen', function() {
    const row = summary.build(logs, catalog.entries).codes[1];
    expect(row.open).toBe(1);
    expect(row.lastSeen).toEqual(new Date('2026-10-25T12:00:00Z'));
  });

  it('breaks ties by code', function() {
    const tied = [
      { code: 'E203', resolved: false, createdAt: '2026-10-25T10:00:00Z' },
      { code: 'E101', resolved: false, createdAt: '2026-10-25T10:00:00Z' }
    ];
    const result = summary.build(tied, catalog.entries);
    expect(result.codes[0].code).toBe('E101');
  });

  it('handles an empty log', function() {
    const result = summary.build([], catalog.entries);
    expect(result.totalLogged).toBe(0);
    expect(result.codes).toEqual([]);
  });
});
