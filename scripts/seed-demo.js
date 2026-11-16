const mongoose = require('mongoose');
const User = require('../models/user');
const Goal = require('../models/goal');
const CheckIn = require('../models/checkin');
const Habit = require('../models/habit');
const auth = require('../auth');

const email = 'demo@recovery.app';
const password = 'demo1234';
const url = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/recovery_tracker';
const dayMs = 24 * 60 * 60 * 1000;

function daysAgo(n) {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - n * dayMs);
}

const defaultHabits = ['Go for a walk', 'Call a friend', 'Drink a glass of water', 'Write in a journal', 'Do a breathing exercise'];
const triggers = ['Stress', 'Boredom', 'Loneliness', 'Social pressure', 'Other'];

async function main() {
  await mongoose.connect(url, { serverSelectionTimeoutMS: 4000 });
  await User.init();
  await CheckIn.init();
  let user = await User.findOne({ email: email });
  if (user) {
    const old = await Goal.find({ userId: user._id });
    const ids = old.map(g => g._id);
    await CheckIn.deleteMany({ goalId: { $in: ids } });
    await Habit.deleteMany({ goalId: { $in: ids } });
    await Goal.deleteMany({ userId: user._id });
  } else {
    user = await User.create({ name: 'Demo User', email: email, passwordHash: await auth.hashPassword(password) });
  }
  const plans = [
    { substance: 'Alcohol', start: 47, cost: 18, relapseAt: 20, notes: 'Weekends are the hard part.' },
    { substance: 'Nicotine', start: 12, cost: 9, notes: '' },
    { substance: 'Sugar', start: 5, cost: 4, notes: 'Cutting soda first.' }
  ];
  for (const plan of plans) {
    const goal = await Goal.create({
      userId: user._id,
      substance: plan.substance,
      startDate: daysAgo(plan.start),
      costPerDay: plan.cost,
      notes: plan.notes,
      relapses: plan.relapseAt ? [{ date: daysAgo(plan.relapseAt), note: 'Went to a party and slipped' }] : []
    });
    const habits = await Habit.insertMany(defaultHabits.map(name => ({ goalId: goal._id, name: name })));
    habits[0].timesUsed = 9;
    habits[0].lastUsed = daysAgo(1);
    habits[4].timesUsed = 4;
    habits[4].lastUsed = daysAgo(3);
    habits[1].timesUsed = 2;
    await Promise.all(habits.map(h => h.save()));
    const rows = [];
    for (let i = 1; i <= Math.min(plan.start, 30); i++) {
      if ((i * 7 + plan.start) % 5 === 0) {
        continue;
      }
      const date = daysAgo(i);
      const weekend = date.getUTCDay() === 5 || date.getUTCDay() === 6;
      const craving = Math.max(0, Math.min(10, (weekend ? 7 : 3) + ((i * 3) % 3) - 1));
      rows.push({
        goalId: goal._id,
        date: date,
        mood: weekend ? 2 + (i % 2) : 3 + (i % 3 === 0 ? 1 : 0),
        craving: craving,
        trigger: craving >= 6 ? triggers[(i + 3) % 4 === 0 ? 3 : 0] : (i % 4 === 0 ? 'Boredom' : ''),
        note: i % 6 === 0 ? 'Felt steady today' : ''
      });
    }
    await CheckIn.insertMany(rows);
  }
  console.log('Demo data ready. Sign in with ' + email + ' and password ' + password);
  await mongoose.disconnect();
}

main().catch(err => {
  console.log('Could not load the demo data: ' + err.message);
  process.exit(1);
});
