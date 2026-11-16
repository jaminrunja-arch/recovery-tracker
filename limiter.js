function create(max, windowMs, clock) {
  const now = clock || Date.now;
  const hits = new Map();

  function purge(t) {
    hits.forEach(function(entry, key) {
      if (t - entry.start >= windowMs) {
        hits.delete(key);
      }
    });
  }

  function hit(key) {
    const t = now();
    if (hits.size > 10000) {
      purge(t);
    }
    let entry = hits.get(key);
    if (!entry || t - entry.start >= windowMs) {
      entry = { start: t, count: 0 };
      hits.set(key, entry);
    }
    entry.count += 1;
    return {
      allowed: entry.count <= max,
      retryAfter: Math.ceil((entry.start + windowMs - t) / 1000)
    };
  }

  function size() {
    return hits.size;
  }

  return { hit: hit, size: size };
}

module.exports = { create: create };
