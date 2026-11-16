function lastSeen(logs) {
  let last = null;
  logs.forEach(function(l) {
    const time = new Date(l.createdAt);
    if (last === null || time > last) {
      last = time;
    }
  });
  return last;
}

function build(logs, entries) {
  const rows = entries.map(function(e) {
    const mine = logs.filter(function(l) {
      return l.code === e.code;
    });
    return {
      code: e.code,
      area: e.area,
      status: e.status,
      message: e.message,
      count: mine.length,
      open: mine.filter(function(l) {
        return !l.resolved;
      }).length,
      lastSeen: lastSeen(mine)
    };
  });
  const seen = rows.filter(function(r) {
    return r.count > 0;
  });
  seen.sort(function(a, b) {
    return b.count - a.count || a.code.localeCompare(b.code);
  });
  return {
    totalLogged: logs.length,
    totalOpen: logs.filter(function(l) {
      return !l.resolved;
    }).length,
    codesInCatalog: entries.length,
    codes: seen
  };
}

module.exports = {
  build: build
};
