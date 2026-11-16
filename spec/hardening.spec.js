const headers = require('../headers');
const registry = require('../errors/registry');
const classify = require('../errors/classify');
const catalog = require('../errors/catalog');
const limits = require('../limits');

describe('security headers', function() {
  function run() {
    const sent = {};
    const res = {
      setHeader: function(name, value) {
        sent[name] = value;
      }
    };
    let called = false;
    headers({}, res, function() {
      called = true;
    });
    return { sent: sent, called: called };
  }

  it('sets the protective headers and moves on', function() {
    const result = run();
    expect(result.called).toBe(true);
    expect(result.sent['X-Content-Type-Options']).toBe('nosniff');
    expect(result.sent['X-Frame-Options']).toBe('DENY');
    expect(result.sent['Referrer-Policy']).toBe('no-referrer');
  });

  it('only allows scripts from the same site and refuses framing', function() {
    const policy = run().sent['Content-Security-Policy'];
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain('unsafe-eval');
  });
});

describe('registry cap', function() {
  it('counts how many entries are over the cap', function() {
    expect(registry.overflow(501, 500)).toBe(1);
    expect(registry.overflow(1200, 500)).toBe(700);
  });

  it('is zero at or under the cap', function() {
    expect(registry.overflow(500, 500)).toBe(0);
    expect(registry.overflow(3, 500)).toBe(0);
  });
});

describe('classify for the Week 9 errors', function() {
  it('maps a body that is too large', function() {
    expect(classify({ type: 'entity.too.large' })).toBe('E904');
  });

  it('maps a duplicate key to the duplicate check-in code', function() {
    expect(classify({ name: 'MongoServerError', code: 11000 })).toBe('E203');
  });

  it('maps database connection errors', function() {
    expect(classify({ name: 'MongooseServerSelectionError' })).toBe('E906');
    expect(classify({ name: 'MongoNetworkError' })).toBe('E906');
  });

  it('maps text that is too long by field', function() {
    function tooLong(path) {
      const errors = {};
      errors[path] = { path: path, kind: 'maxlength' };
      return { name: 'ValidationError', errors: errors };
    }
    expect(classify(tooLong('substance'))).toBe('E109');
    expect(classify(tooLong('notes'))).toBe('E108');
    expect(classify(tooLong('note'))).toBe('E206');
    expect(classify(tooLong('name'))).toBe('E402');
  });

  it('maps a trigger that is not on the list', function() {
    expect(classify({ name: 'ValidationError', errors: { trigger: { path: 'trigger', kind: 'enum' } } })).toBe('E207');
  });
});

describe('limits and catalog together', function() {
  it('has a catalog entry for every code the limits can raise', function() {
    ['E107', 'E108', 'E109', 'E110', 'E206', 'E207', 'E304', 'E404', 'E904', 'E905', 'E906'].forEach(function(code) {
      expect(catalog.find(code).code).toBe(code);
    });
  });

  it('gives the new codes the right HTTP status', function() {
    expect(catalog.find('E904').status).toBe(413);
    expect(catalog.find('E905').status).toBe(429);
    expect(catalog.find('E906').status).toBe(503);
    expect(catalog.find('E107').status).toBe(409);
  });

  it('puts the limits into the messages', function() {
    expect(catalog.find('E107').message).toContain(String(limits.maxGoals));
    expect(catalog.find('E304').message).toContain(String(limits.maxRelapses));
    expect(catalog.find('E404').message).toContain(String(limits.maxHabits));
  });

  it('lists the same triggers the form offers', function() {
    expect(limits.triggers).toEqual(['Stress', 'Boredom', 'Loneliness', 'Social pressure', 'Other']);
  });
});
