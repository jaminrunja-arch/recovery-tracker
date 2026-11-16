module.exports = {
  maxGoals: 25,
  maxHabits: 30,
  maxRelapses: 50,
  maxName: 60,
  maxNotes: 500,
  maxNote: 500,
  earliestStart: new Date('1900-01-01T00:00:00Z'),
  triggers: ['Stress', 'Boredom', 'Loneliness', 'Social pressure', 'Other'],
  bodyLimit: '10kb',
  errorLogCap: 500,
  rateWindowMs: 60 * 1000,
  rateMax: 300,
  authMax: 20
};
