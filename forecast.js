const dayMs = 24 * 60 * 60 * 1000;
const minSamples = 2;
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function levelFor(avg) {
  if (avg >= 7) {
    return 'high';
  }
  if (avg >= 4) {
    return 'medium';
  }
  return 'low';
}

function weekdayStats(checkins) {
  const groups = dayNames.map(function(name, i) {
    return { weekday: i, name: name, count: 0, total: 0, triggers: {} };
  });
  checkins.forEach(function(c) {
    const g = groups[new Date(c.date).getUTCDay()];
    g.count += 1;
    g.total += c.craving;
    if (c.trigger) {
      g.triggers[c.trigger] = (g.triggers[c.trigger] || 0) + 1;
    }
  });
  return groups.map(function(g) {
    const names = Object.keys(g.triggers).sort(function(a, b) {
      return g.triggers[b] - g.triggers[a] || a.localeCompare(b);
    });
    return {
      weekday: g.weekday,
      name: g.name,
      count: g.count,
      avgCraving: g.count ? Math.round(g.total / g.count * 10) / 10 : null,
      topTrigger: names.length ? names[0] : ''
    };
  });
}

function forecast(checkins, today, days) {
  const stats = weekdayStats(checkins);
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(new Date(today).getTime() + i * dayMs);
    const s = stats[date.getUTCDay()];
    const rated = s.count >= minSamples;
    out.push({
      date: date,
      weekday: s.name,
      level: rated ? levelFor(s.avgCraving) : 'unknown',
      avgCraving: rated ? s.avgCraving : null,
      count: s.count,
      topTrigger: s.topTrigger
    });
  }
  return out;
}

function plan(habits) {
  const used = habits.filter(function(h) {
    return h.timesUsed > 0;
  });
  if (!used.length) {
    return null;
  }
  used.sort(function(a, b) {
    return b.timesUsed - a.timesUsed || a.name.localeCompare(b.name);
  });
  return { name: used[0].name, timesUsed: used[0].timesUsed };
}

module.exports = {
  minSamples: minSamples,
  levelFor: levelFor,
  weekdayStats: weekdayStats,
  forecast: forecast,
  plan: plan
};
