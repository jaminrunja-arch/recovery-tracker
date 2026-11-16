const auth = require('../auth');

describe('auth', function() {
  it('accepts the right password and rejects a wrong one', async function() {
    const stored = await auth.hashPassword('correct horse');
    expect(await auth.checkPassword('correct horse', stored)).toBe(true);
    expect(await auth.checkPassword('wrong horse', stored)).toBe(false);
  });

  it('gives the same password two different hashes', async function() {
    const one = await auth.hashPassword('same password');
    const two = await auth.hashPassword('same password');
    expect(one).not.toBe(two);
  });

  it('does not accept a malformed stored hash', async function() {
    expect(await auth.checkPassword('anything', 'nonsense')).toBe(false);
  });

  it('reads back the user id from a token it made', function() {
    const token = auth.makeToken('64b7f0f0f0f0f0f0f0f0f0f0');
    expect(auth.readToken(token)).toBe('64b7f0f0f0f0f0f0f0f0f0f0');
  });

  it('rejects a token with a changed body', function() {
    const token = auth.makeToken('64b7f0f0f0f0f0f0f0f0f0f0');
    const parts = token.split('.');
    const forged = Buffer.from(JSON.stringify({ uid: '64b7f0f0f0f0f0f0f0f0f0f1', exp: Date.now() + 100000 })).toString('base64url');
    expect(auth.readToken(forged + '.' + parts[1])).toBeNull();
  });

  it('rejects an expired token', function() {
    const old = auth.makeToken('64b7f0f0f0f0f0f0f0f0f0f0', Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(auth.readToken(old)).toBeNull();
  });

  it('rejects things that are not tokens', function() {
    expect(auth.readToken(undefined)).toBeNull();
    expect(auth.readToken('abc')).toBeNull();
    expect(auth.readToken('a.b.c')).toBeNull();
    expect(auth.readToken({})).toBeNull();
  });

  it('answers 401 E606 when no token is sent', function() {
    let error;
    auth.requireUser({ headers: {} }, {}, function(err) {
      error = err;
    });
    expect(error.code).toBe('E606');
    expect(error.status).toBe(401);
  });

  it('sets the user id when a good token is sent', function() {
    const req = { headers: { authorization: 'Bearer ' + auth.makeToken('64b7f0f0f0f0f0f0f0f0f0f0') } };
    let error = 'not called';
    auth.requireUser(req, {}, function(err) {
      error = err;
    });
    expect(error).toBeUndefined();
    expect(req.userId).toBe('64b7f0f0f0f0f0f0f0f0f0f0');
  });
});
