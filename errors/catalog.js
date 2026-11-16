const entries = [
  { code: 'E101', status: 400, area: 'Goals', message: 'Enter the substance or habit you are working on' },
  { code: 'E102', status: 400, area: 'Goals', message: 'Choose a start date' },
  { code: 'E103', status: 400, area: 'Goals', message: 'Start date cannot be in the future' },
  { code: 'E104', status: 400, area: 'Goals', message: 'Cost per day must be a number from 0 to 1000' },
  { code: 'E105', status: 404, area: 'Goals', message: 'Goal not found' },
  { code: 'E106', status: 400, area: 'Goals', message: 'Choose a goal' },
  { code: 'E107', status: 409, area: 'Goals', message: 'You have reached the limit of 25 goals' },
  { code: 'E108', status: 400, area: 'Goals', message: 'Notes must be 500 characters or fewer' },
  { code: 'E109', status: 400, area: 'Goals', message: 'Substance or habit name must be 60 characters or fewer' },
  { code: 'E110', status: 400, area: 'Goals', message: 'Start date is too far in the past' },
  { code: 'E201', status: 400, area: 'Check-ins', message: 'Choose a valid date' },
  { code: 'E202', status: 400, area: 'Check-ins', message: 'Check-in date cannot be in the future' },
  { code: 'E203', status: 409, area: 'Check-ins', message: 'You already checked in for that day' },
  { code: 'E204', status: 400, area: 'Check-ins', message: 'Mood must be a number from 1 to 5' },
  { code: 'E205', status: 400, area: 'Check-ins', message: 'Craving must be a number from 0 to 10' },
  { code: 'E206', status: 400, area: 'Check-ins', message: 'Check-in note must be 500 characters or fewer' },
  { code: 'E207', status: 400, area: 'Check-ins', message: 'Choose a trigger from the list' },
  { code: 'E301', status: 400, area: 'Relapses', message: 'Choose a valid date' },
  { code: 'E302', status: 400, area: 'Relapses', message: 'Relapse date cannot be before the start date' },
  { code: 'E303', status: 400, area: 'Relapses', message: 'Relapse date cannot be in the future' },
  { code: 'E304', status: 409, area: 'Relapses', message: 'You have reached the limit of 50 relapses for this goal' },
  { code: 'E401', status: 400, area: 'Habits', message: 'Enter a habit name' },
  { code: 'E402', status: 400, area: 'Habits', message: 'Habit name is too long' },
  { code: 'E403', status: 404, area: 'Habits', message: 'Habit not found' },
  { code: 'E404', status: 409, area: 'Habits', message: 'You have reached the limit of 30 habits for this goal' },
  { code: 'E501', status: 404, area: 'Registry', message: 'Error log entry not found' },
  { code: 'E601', status: 400, area: 'Accounts', message: 'Enter your name (60 characters or fewer)' },
  { code: 'E602', status: 400, area: 'Accounts', message: 'Enter a valid email address' },
  { code: 'E603', status: 400, area: 'Accounts', message: 'Password must be 8 to 72 characters' },
  { code: 'E604', status: 409, area: 'Accounts', message: 'That email is already registered' },
  { code: 'E605', status: 401, area: 'Accounts', message: 'Wrong email or password' },
  { code: 'E606', status: 401, area: 'Accounts', message: 'Please sign in to continue' },
  { code: 'E901', status: 400, area: 'System', message: 'Invalid id' },
  { code: 'E902', status: 404, area: 'System', message: 'That address does not exist' },
  { code: 'E903', status: 400, area: 'System', message: 'The request body is not valid JSON' },
  { code: 'E904', status: 413, area: 'System', message: 'The request is too large' },
  { code: 'E905', status: 429, area: 'System', message: 'Too many requests, try again in a minute' },
  { code: 'E906', status: 503, area: 'System', message: 'The database is not available, try again soon' },
  { code: 'E999', status: 500, area: 'System', message: 'Unexpected server error' }
];

function find(code) {
  const entry = entries.find(function(e) {
    return e.code === code;
  });
  return entry || entries[entries.length - 1];
}

module.exports = {
  entries: entries,
  find: find
};
