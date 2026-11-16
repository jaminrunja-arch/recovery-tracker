const cache = require('../cache');

describe('cache', function() {
  beforeEach(function() {
    cache.bump();
  });

  it('runs the loader once for requests that share a key', async function() {
    let calls = 0;
    const load = function() {
      calls += 1;
      return Promise.resolve(calls);
    };
    const results = await Promise.all([cache.get('a', load), cache.get('a', load), cache.get('a', load)]);
    expect(calls).toBe(1);
    expect(results).toEqual([1, 1, 1]);
  });

  it('keeps separate keys apart', async function() {
    const one = await cache.get('a', function() { return Promise.resolve('x'); });
    const two = await cache.get('b', function() { return Promise.resolve('y'); });
    expect(one).toBe('x');
    expect(two).toBe('y');
  });

  it('loads again after a bump', async function() {
    let calls = 0;
    const load = function() {
      calls += 1;
      return Promise.resolve(calls);
    };
    await cache.get('a', load);
    cache.bump();
    const second = await cache.get('a', load);
    expect(second).toBe(2);
  });

  it('does not reuse a result that started before a bump', async function() {
    let release;
    const slow = function() {
      return new Promise(function(resolve) {
        release = resolve;
      });
    };
    const first = cache.get('a', slow);
    cache.bump();
    const second = cache.get('a', function() { return Promise.resolve('fresh'); });
    release('old');
    expect(await first).toBe('old');
    expect(await second).toBe('fresh');
  });

  it('forgets a failed load so the next request tries again', async function() {
    let calls = 0;
    const load = function() {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error('boom')) : Promise.resolve('ok');
    };
    await expectAsync(cache.get('a', load)).toBeRejected();
    expect(await cache.get('a', load)).toBe('ok');
  });

  it('never holds more than 50 keys', async function() {
    for (let i = 0; i < 80; i++) {
      await cache.get('k' + i, function() { return Promise.resolve(i); });
    }
    expect(cache.size()).toBeLessThanOrEqual(50);
  });
});
