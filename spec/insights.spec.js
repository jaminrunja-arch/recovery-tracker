const insights = require('../insights');

describe('check-in consistency', function() {
  const today = new Date('2026-10-18T00:00:00Z');

  it('counts the distinct days inside the window', function() {
    const items = [
      { date: new Date('2026-10-18') },
      { date: new Date('2026-10-17') },
      { date: new Date('2026-10-15') },
      { date: new Date('2026-10-05') },
      { date: new Date('2026-10-04') },
      { date: new Date('2026-10-19') }
    ];
    const result = insights.consistency(items, today, 14);
    expect(result.done).toBe(4);
    expect(result.of).toBe(14);
    expect(result.percent).toBe(29);
  });

  it('counts a day only once', function() {
    const items = [{ date: new Date('2026-10-17') }, { date: new Date('2026-10-17') }];
    expect(insights.consistency(items, today, 14).done).toBe(1);
  });

  it('is zero with no check-ins', function() {
    const result = insights.consistency([], today, 14);
    expect(result.done).toBe(0);
    expect(result.percent).toBe(0);
  });
});

describe('trigger breakdown', function() {
  it('groups by trigger and sorts by how often it appears', function() {
    const items = [
      { trigger: 'Stress', craving: 8 },
      { trigger: 'Stress', craving: 6 },
      { trigger: 'Boredom', craving: 4 },
      { trigger: '', craving: 9 },
      { trigger: 'Loneliness', craving: 5 },
      { trigger: 'Loneliness', craving: 6 }
    ];
    const rows = insights.triggerBreakdown(items);
    expect(rows.length).toBe(3);
    expect(rows[0]).toEqual({ trigger: 'Stress', count: 2, avgCraving: 7 });
    expect(rows[1]).toEqual({ trigger: 'Loneliness', count: 2, avgCraving: 5.5 });
    expect(rows[2]).toEqual({ trigger: 'Boredom', count: 1, avgCraving: 4 });
  });

  it('returns an empty list when no triggers were logged', function() {
    expect(insights.triggerBreakdown([{ trigger: '', craving: 3 }])).toEqual([]);
  });
});

describe('peak craving', function() {
  const today = new Date('2026-10-18T00:00:00Z');

  it('picks the highest craving in the window', function() {
    const items = [
      { date: new Date('2026-10-16'), craving: 5, trigger: 'Stress' },
      { date: new Date('2026-10-14'), craving: 9, trigger: 'Boredom' }
    ];
    const result = insights.peakCraving(items, today, 14);
    expect(result.craving).toBe(9);
    expect(result.trigger).toBe('Boredom');
  });

  it('prefers the most recent day when cravings tie', function() {
    const items = [
      { date: new Date('2026-10-16'), craving: 7, trigger: 'Stress' },
      { date: new Date('2026-10-17'), craving: 7, trigger: 'Boredom' }
    ];
    const result = insights.peakCraving(items, today, 14);
    expect(result.date).toEqual(new Date('2026-10-17'));
    expect(result.trigger).toBe('Boredom');
  });

  it('ignores check-ins outside the window and shows an empty trigger', function() {
    const items = [{ date: new Date('2026-09-28'), craving: 10, trigger: 'Stress' }];
    expect(insights.peakCraving(items, today, 14)).toBeNull();
    const inside = [{ date: new Date('2026-10-17'), craving: 3 }];
    expect(insights.peakCraving(inside, today, 14).trigger).toBe('');
  });
});
