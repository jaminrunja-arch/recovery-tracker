const streak = require('./streak');

function consistency(checkins, today, days) {
  const seen = {};
  checkins.forEach(function(c) {
    const age = streak.daysBetween(c.date, today);
    if (age >= 0 && age < days) {
      seen[age] = true;
    }
  });
  const done = Object.keys(seen).length;
  return {
    done: done,
    of: days,
    percent: Math.round(done / days * 100)
  };
}

function triggerBreakdown(checkins) {
  const groups = {};
  checkins.forEach(function(c) {
    if (!c.trigger) {
      return;
    }
    if (!groups[c.trigger]) {
      groups[c.trigger] = { trigger: c.trigger, count: 0, total: 0 };
    }
    groups[c.trigger].count += 1;
    groups[c.trigger].total += c.craving;
  });
  const rows = Object.keys(groups).map(function(t) {
    const g = groups[t];
    return {
      trigger: g.trigger,
      count: g.count,
      avgCraving: Math.round(g.total / g.count * 10) / 10
    };
  });
  rows.sort(function(a, b) {
    return b.count - a.count || b.avgCraving - a.avgCraving;
  });
  return rows;
}

function peakCraving(checkins, today, days) {
  let best = null;
  checkins.forEach(function(c) {
    const age = streak.daysBetween(c.date, today);
    if (age < 0 || age >= days) {
      return;
    }
    const higher = best === null || c.craving > best.craving;
    const tieAndNewer = best !== null && c.craving === best.craving && new Date(c.date) > new Date(best.date);
    if (higher || tieAndNewer) {
      best = c;
    }
  });
  if (best === null) {
    return null;
  }
  return { date: best.date, craving: best.craving, trigger: best.trigger || '' };
}

module.exports = {
  consistency: consistency,
  triggerBreakdown: triggerBreakdown,
  peakCraving: peakCraving
};
