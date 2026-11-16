const streak = require('../streak');

function makeGoal(start, relapseDates, cost) {
  return {
    startDate: new Date(start),
    costPerDay: cost,
    relapses: (relapseDates || []).map(function(d) {
      return { date: new Date(d) };
    })
  };
}

describe('streak calculations', function() {
  const today = new Date('2026-10-18T00:00:00Z');

  it('counts days from the start date', function() {
    const goal = makeGoal('2026-09-25');
    expect(streak.currentStreak(goal, today)).toBe(23);
  });

  it('never returns a negative streak', function() {
    const goal = makeGoal('2026-10-20');
    expect(streak.currentStreak(goal, today)).toBe(0);
  });

  it('restarts the current streak after a relapse', function() {
    const goal = makeGoal('2026-09-01', ['2026-10-10']);
    expect(streak.currentStreak(goal, today)).toBe(8);
  });

  it('keeps the longest streak after a relapse', function() {
    const goal = makeGoal('2026-09-01', ['2026-10-10']);
    expect(streak.longestStreak(goal, today)).toBe(39);
  });

  it('uses the current run as the longest when it is the best', function() {
    const goal = makeGoal('2026-09-25', ['2026-09-27']);
    expect(streak.longestStreak(goal, today)).toBe(21);
  });
});

describe('milestones', function() {
  it('finds the next milestone', function() {
    expect(streak.nextMilestone(0)).toBe(1);
    expect(streak.nextMilestone(7)).toBe(14);
    expect(streak.nextMilestone(23)).toBe(30);
  });

  it('returns null after the last milestone', function() {
    expect(streak.nextMilestone(400)).toBeNull();
  });

  it('calculates progress between milestones', function() {
    expect(streak.milestoneProgress(10)).toBe(43);
    expect(streak.milestoneProgress(0)).toBe(0);
    expect(streak.milestoneProgress(400)).toBe(100);
  });
});

describe('money saved', function() {
  it('multiplies the days by the cost per day', function() {
    expect(streak.moneySaved(makeGoal('2026-09-25', [], 12.5), 23)).toBe(287.5);
  });

  it('rounds to cents', function() {
    expect(streak.moneySaved(makeGoal('2026-09-25', [], 3.333), 3)).toBe(10);
  });

  it('is zero when no cost was entered', function() {
    expect(streak.moneySaved(makeGoal('2026-09-25'), 23)).toBe(0);
  });

  it('is zero on day zero', function() {
    expect(streak.moneySaved(makeGoal('2026-09-25', [], 10), 0)).toBe(0);
  });
});

describe('check-in statistics', function() {
  it('returns null when there are no check-ins', function() {
    expect(streak.average([], 'mood')).toBeNull();
  });

  it('averages to one decimal place', function() {
    const items = [{ craving: 2 }, { craving: 5 }, { craving: 4 }];
    expect(streak.average(items, 'craving')).toBe(3.7);
  });

  it('finds the most common trigger on high craving days', function() {
    const items = [
      { craving: 8, trigger: 'Stress' },
      { craving: 7, trigger: 'Stress' },
      { craving: 9, trigger: 'Boredom' },
      { craving: 2, trigger: 'Loneliness' },
      { craving: 3, trigger: 'Loneliness' },
      { craving: 1, trigger: 'Loneliness' }
    ];
    expect(streak.topTrigger(items)).toBe('Stress');
  });

  it('returns null when no day had a high craving', function() {
    expect(streak.topTrigger([{ craving: 2, trigger: 'Stress' }])).toBeNull();
  });
});

describe('date checks', function() {
  const today = new Date('2026-10-18T00:00:00Z');

  it('accepts a plain day string', function() {
    expect(streak.parseDay('2026-10-18').toISOString()).toBe('2026-10-18T00:00:00.000Z');
  });

  it('rejects bad input', function() {
    expect(streak.parseDay('10/18/2026')).toBeNull();
    expect(streak.parseDay('2026-13-45')).toBeNull();
    expect(streak.parseDay(undefined)).toBeNull();
  });

  it('allows tomorrow for time zone differences but not later', function() {
    expect(streak.isFuture(new Date('2026-10-19T00:00:00Z'), today)).toBe(false);
    expect(streak.isFuture(new Date('2026-10-21T00:00:00Z'), today)).toBe(true);
  });
});

describe('summary', function() {
  const today = new Date('2026-10-18T00:00:00Z');

  it('combines the streak, milestone and check-in numbers', function() {
    const goal = makeGoal('2026-09-25');
    const checkins = [
      { date: new Date('2026-10-17'), mood: 4, craving: 3, trigger: 'Stress' },
      { date: new Date('2026-10-16'), mood: 2, craving: 7, trigger: 'Stress' }
    ];
    const result = streak.summary(goal, checkins, today);
    expect(result.currentStreak).toBe(23);
    expect(result.nextMilestone).toBe(30);
    expect(result.daysToNext).toBe(7);
    expect(result.avgMood).toBe(3);
    expect(result.avgCraving).toBe(5);
    expect(result.topTrigger).toBe('Stress');
  });

  it('includes the money saved', function() {
    const result = streak.summary(makeGoal('2026-09-25', [], 10), [], today);
    expect(result.moneySaved).toBe(230);
  });
});
