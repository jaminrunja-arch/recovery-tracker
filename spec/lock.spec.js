const lock = require('../lock');

function wait(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

describe('keyed lock', function() {
  it('returns what the function returns', async function() {
    expect(await lock.run('a', async function() {
      return 42;
    })).toBe(42);
  });

  it('runs tasks with the same key one at a time', async function() {
    let running = 0;
    let most = 0;
    const task = async function() {
      running += 1;
      most = Math.max(most, running);
      await wait(5);
      running -= 1;
    };
    await Promise.all([lock.run('same', task), lock.run('same', task), lock.run('same', task), lock.run('same', task)]);
    expect(most).toBe(1);
  });

  it('keeps the order the tasks were started in', async function() {
    const order = [];
    await Promise.all([1, 2, 3, 4].map(function(n) {
      return lock.run('order', async function() {
        await wait(5 - n);
        order.push(n);
      });
    }));
    expect(order).toEqual([1, 2, 3, 4]);
  });

  it('lets different keys run together', async function() {
    let running = 0;
    let most = 0;
    const task = async function() {
      running += 1;
      most = Math.max(most, running);
      await wait(10);
      running -= 1;
    };
    await Promise.all([lock.run('x', task), lock.run('y', task), lock.run('z', task)]);
    expect(most).toBe(3);
  });

  it('lets later tasks run after one fails', async function() {
    const failed = lock.run('fail', async function() {
      throw new Error('boom');
    });
    await expectAsync(failed).toBeRejectedWithError('boom');
    expect(await lock.run('fail', async function() {
      return 'ok';
    })).toBe('ok');
  });

  it('keeps no keys when everything is done', async function() {
    await lock.run('clean', async function() {});
    await wait(5);
    expect(lock.pending()).toBe(0);
  });

  it('makes a read then write sequence safe', async function() {
    let value = 0;
    const bump = function() {
      return lock.run('counter', async function() {
        const seen = value;
        await wait(1);
        value = seen + 1;
      });
    };
    await Promise.all(Array.from({ length: 20 }, bump));
    expect(value).toBe(20);
  });
});
