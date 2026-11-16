const forecast = require('../forecast');

const checkins = [
  { date: new Date('2026-10-16'), craving: 8, trigger: 'Social pressure' },
  { date: new Date('2026-10-23'), craving: 9, trigger: 'Social pressure' },
  { date: new Date('2026-10-09'), craving: 7, trigger: 'Stress' },
  { date: new Date('2026-10-12'), craving: 4, trigger: 'Stress' },
  { date: new Date('2026-10-19'), craving: 5, trigger: 'Stress' },
  { date: new Date('2026-10-13'), craving: 1, trigger: '' },
  { date: new Date('2026-10-20'), craving: 2, trigger: '' },
  { date: new Date('2026-10-21'), craving: 9, trigger: 'Boredom' }
];

describe('risk level', function() {
  it('is high from 7 up', function() {
    expect(forecast.levelFor(7)).toBe('high');
    expect(forecast.levelFor(10)).toBe('high');
  });

  it('is medium from 4 up to 7', function() {
    expect(forecast.levelFor(4)).toBe('medium');
    expect(forecast.levelFor(6.9)).toBe('medium');
  });

  it('is low below 4', function() {
    expect(forecast.levelFor(3.9)).toBe('low');
    expect(forecast.levelFor(0)).toBe('low');
  });
});

describe('weekday stats', function() {
  const stats = forecast.weekdayStats(checkins);

  it('returns seven days starting on Sunday', function() {
    expect(stats.length).toBe(7);
    expect(stats[0].name).toBe('Sunday');
    expect(stats[6].name).toBe('Saturday');
  });

  it('averages the craving for a weekday', function() {
    expect(stats[5].count).toBe(3);
    expect(stats[5].avgCraving).toBe(8);
  });

  it('picks the most common trigger for a weekday', function() {
    expect(stats[5].topTrigger).toBe('Social pressure');
    expect(stats[1].topTrigger).toBe('Stress');
  });

  it('leaves a weekday with no check-ins empty', function() {
    expect(stats[0].count).toBe(0);
    expect(stats[0].avgCraving).toBeNull();
    expect(stats[0].topTrigger).toBe('');
  });

  it('breaks trigger ties by name', function() {
    const tied = [
      { date: new Date('2026-10-16'), craving: 5, trigger: 'Stress' },
      { date: new Date('2026-10-23'), craving: 5, trigger: 'Boredom' }
    ];
    expect(forecast.weekdayStats(tied)[5].topTrigger).toBe('Boredom');
  });
});

describe('forecast', function() {
  const today = new Date('2026-10-25T00:00:00Z');
  const days = forecast.forecast(checkins, today, 7);

  it('covers the number of days asked for, starting today', function() {
    expect(days.length).toBe(7);
    expect(days[0].date).toEqual(new Date('2026-10-25T00:00:00Z'));
    expect(days[0].weekday).toBe('Sunday');
    expect(days[6].weekday).toBe('Saturday');
  });

  it('rates a weekday from the average craving', function() {
    expect(days[1].level).toBe('medium');
    expect(days[2].level).toBe('low');
    expect(days[5].level).toBe('high');
  });

  it('does not rate a weekday with fewer than 2 check-ins', function() {
    expect(days[0].level).toBe('unknown');
    expect(days[3].level).toBe('unknown');
    expect(days[3].count).toBe(1);
    expect(days[3].avgCraving).toBeNull();
  });

  it('carries the average, count and trigger', function() {
    expect(days[5].avgCraving).toBe(8);
    expect(days[5].count).toBe(3);
    expect(days[5].topTrigger).toBe('Social pressure');
  });

  it('rates every day unknown with no check-ins', function() {
    const empty = forecast.forecast([], today, 7);
    expect(empty.every(function(d) { return d.level === 'unknown'; })).toBe(true);
  });
});

describe('plan', function() {
  it('picks the habit used most', function() {
    const result = forecast.plan([
      { name: 'Call a friend', timesUsed: 2 },
      { name: 'Go for a walk', timesUsed: 3 },
      { name: 'Do a breathing exercise', timesUsed: 1 }
    ]);
    expect(result).toEqual({ name: 'Go for a walk', timesUsed: 3 });
  });

  it('breaks ties by name', function() {
    const result = forecast.plan([
      { name: 'Go for a walk', timesUsed: 2 },
      { name: 'Call a friend', timesUsed: 2 }
    ]);
    expect(result.name).toBe('Call a friend');
  });

  it('is null when no habit has been used', function() {
    expect(forecast.plan([{ name: 'Go for a walk', timesUsed: 0 }])).toBeNull();
    expect(forecast.plan([])).toBeNull();
  });
});
