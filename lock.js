const tails = new Map();

function run(key, fn) {
  const previous = tails.get(key) || Promise.resolve();
  const next = previous.then(fn, fn);
  const tail = next.catch(function() {});
  tails.set(key, tail);
  tail.then(function() {
    if (tails.get(key) === tail) {
      tails.delete(key);
    }
  });
  return next;
}

function pending() {
  return tails.size;
}

module.exports = {
  run: run,
  pending: pending
};
