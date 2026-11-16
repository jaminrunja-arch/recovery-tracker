let version = 0;
const entries = new Map();

function bump() {
  version += 1;
  entries.clear();
}

function get(key, load) {
  const found = entries.get(key);
  if (found && found.version === version) {
    return found.value;
  }
  if (entries.size >= 50) {
    entries.clear();
  }
  const entry = { version: version, value: null };
  entry.value = load().catch(function(err) {
    if (entries.get(key) === entry) {
      entries.delete(key);
    }
    throw err;
  });
  entries.set(key, entry);
  return entry.value;
}

function size() {
  return entries.size;
}

module.exports = { bump: bump, get: get, size: size };
