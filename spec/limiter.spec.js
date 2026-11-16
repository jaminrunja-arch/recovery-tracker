const limiter = require('../limiter');

describe('rate limiter', function() {
  let time;
  const clock = function() {
    return time;
  };

  beforeEach(function() {
    time = 1000000;
  });

  it('allows requests up to the maximum', function() {
    const l = limiter.create(3, 60000, clock);
    expect(l.hit('a').allowed).toBe(true);
    expect(l.hit('a').allowed).toBe(true);
    expect(l.hit('a').allowed).toBe(true);
  });

  it('blocks the request after the maximum', function() {
    const l = limiter.create(3, 60000, clock);
    for (let i = 0; i < 3; i++) {
      l.hit('a');
    }
    expect(l.hit('a').allowed).toBe(false);
    expect(l.hit('a').allowed).toBe(false);
  });

  it('reports how many seconds are left in the window', function() {
    const l = limiter.create(1, 60000, clock);
    l.hit('a');
    time += 15000;
    expect(l.hit('a').retryAfter).toBe(45);
  });

  it('counts each key on its own', function() {
    const l = limiter.create(1, 60000, clock);
    l.hit('a');
    expect(l.hit('a').allowed).toBe(false);
    expect(l.hit('b').allowed).toBe(true);
  });

  it('starts a new window after the time is up', function() {
    const l = limiter.create(1, 60000, clock);
    l.hit('a');
    expect(l.hit('a').allowed).toBe(false);
    time += 60000;
    expect(l.hit('a').allowed).toBe(true);
  });

  it('forgets expired keys when the table gets big', function() {
    const l = limiter.create(5, 60000, clock);
    for (let i = 0; i < 10001; i++) {
      l.hit('key' + i);
    }
    expect(l.size()).toBe(10001);
    time += 60000;
    l.hit('fresh');
    expect(l.size()).toBe(1);
  });
});
