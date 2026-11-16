const Goal = require('../models/goal');
const AppError = require('../errors/appError');
const validate = require('../validate');

async function goalFor(userId, goalId) {
  const goal = await Goal.findOne({ _id: validate.readId(goalId), userId: userId });
  if (!goal) {
    throw new AppError('E105');
  }
  return goal;
}

module.exports = { goalFor: goalFor };
