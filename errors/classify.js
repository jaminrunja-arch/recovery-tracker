const byPath = {
  substance: 'E101',
  startDate: 'E102',
  costPerDay: 'E104',
  goalId: 'E106',
  date: 'E201',
  mood: 'E204',
  craving: 'E205',
  trigger: 'E207',
  name: 'E401'
};

const lengthCodes = {
  substance: 'E109',
  notes: 'E108',
  note: 'E206',
  name: 'E402'
};

const databaseErrors = ['MongooseServerSelectionError', 'MongoServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError'];

function classify(err) {
  if (err.type === 'entity.parse.failed') {
    return 'E903';
  }
  if (err.type === 'entity.too.large') {
    return 'E904';
  }
  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors)[0];
    if (first.kind === 'maxlength' && lengthCodes[first.path]) {
      return lengthCodes[first.path];
    }
    return byPath[first.path] || 'E999';
  }
  if (err.name === 'CastError') {
    return 'E901';
  }
  if (err.code === 11000) {
    return 'E203';
  }
  if (databaseErrors.indexOf(err.name) !== -1) {
    return 'E906';
  }
  return 'E999';
}

module.exports = classify;
