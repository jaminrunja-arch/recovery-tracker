const milestones = [1, 3, 7, 14, 30, 60, 90, 180, 365];
const dayMs = 24 * 60 * 60 * 1000;

function parseDay(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text || '')) {
    return null;
  }
  const d = new Date(text + 'T00:00:00Z');
  if (isNaN(d)) {
    return null;
  }
  return d;
}

function dayNumber(date) {
  return Math.floor(new Date(date).getTime() / dayMs);
}

function daysBetween(from, to) {
  return dayNumber(to) - dayNumber(from);
}

function isFuture(date, today) {
  return daysBetween(today, date) > 1;
}

function lastResetDate(goal) {
  let start = new Date(goal.startDate);
  goal.relapses.forEach(function(r) {
    if (new Date(r.date) > start) {
      start = new Date(r.date);
    }
  });
  return start;
}

function currentStreak(goal, today) {
  return Math.max(0, daysBetween(lastResetDate(goal), today));
}

function longestStreak(goal, today) {
  const dates = goal.relapses.map(function(r) {
    return new Date(r.date);
  });
  dates.sort(function(a, b) {
    return a - b;
  });
  let best = 0;
  let start = new Date(goal.startDate);
  dates.forEach(function(d) {
    if (d < start) {
      return;
    }
    best = Math.max(best, daysBetween(start, d));
    start = d;
  });
  return Math.max(best, daysBetween(start, today));
}

function nextMilestone(days) {
  for (let i = 0; i < milestones.length; i++) {
    if (milestones[i] > days) {
      return milestones[i];
    }
  }
  return null;
}

function milestoneProgress(days) {
  const next = nextMilestone(days);
  if (next === null) {
    return 100;
  }
  let prev = 0;
  milestones.forEach(function(m) {
    if (m <= days) {
      prev = m;
    }
  });
  return Math.round((days - prev) / (next - prev) * 100);
}

function moneySaved(goal, days) {
  const cost = goal.costPerDay || 0;
  return Math.round(days * cost * 100) / 100;
}

function average(items, field) {
  if (items.length === 0) {
    return null;
  }
  let total = 0;
  items.forEach(function(item) {
    total += item[field];
  });
  return Math.round(total / items.length * 10) / 10;
}

function recent(checkins, today, days) {
  return checkins.filter(function(c) {
    const age = daysBetween(c.date, today);
    return age >= 0 && age < days;
  });
}

function topTrigger(checkins) {
  const counts = {};
  checkins.forEach(function(c) {
    if (c.craving >= 6 && c.trigger) {
      counts[c.trigger] = (counts[c.trigger] || 0) + 1;
    }
  });
  let best = null;
  Object.keys(counts).forEach(function(t) {
    if (best === null || counts[t] > counts[best]) {
      best = t;
    }
  });
  return best;
}

function summary(goal, checkins, today) {
  const days = currentStreak(goal, today);
  const next = nextMilestone(days);
  const week = recent(checkins, today, 7);
  return {
    currentStreak: days,
    longestStreak: longestStreak(goal, today),
    relapseCount: goal.relapses.length,
    nextMilestone: next,
    daysToNext: next === null ? 0 : next - days,
    progress: milestoneProgress(days),
    moneySaved: moneySaved(goal, days),
    avgMood: average(week, 'mood'),
    avgCraving: average(week, 'craving'),
    checkInCount: checkins.length,
    topTrigger: topTrigger(checkins)
  };
}

module.exports = {
  milestones: milestones,
  parseDay: parseDay,
  daysBetween: daysBetween,
  isFuture: isFuture,
  currentStreak: currentStreak,
  longestStreak: longestStreak,
  nextMilestone: nextMilestone,
  milestoneProgress: milestoneProgress,
  moneySaved: moneySaved,
  average: average,
  topTrigger: topTrigger,
  summary: summary
};
