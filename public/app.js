var app = angular.module('recoveryApp', []);

app.config(function($httpProvider) {
  $httpProvider.interceptors.push(function($q, $rootScope) {
    return {
      responseError: function(err) {
        if (err.status === 401 && err.data && err.data.code === 'E606') {
          $rootScope.$broadcast('signedOut');
        }
        return $q.reject(err);
      }
    };
  });
});

app.controller('MainCtrl', function($scope, $http, $timeout) {
  $scope.mainViews = [
    { id: 'dashboard', label: 'Dashboard', icon: 'i-home' },
    { id: 'checkin', label: 'Check-in', icon: 'i-check' },
    { id: 'habits', label: 'Habits', icon: 'i-habit' },
    { id: 'insights', label: 'Insights', icon: 'i-chart' }
  ];
  $scope.moreViews = [
    { id: 'forecast', label: 'Forecast', icon: 'i-cloud' },
    { id: 'resources', label: 'Resources', icon: 'i-phone' },
    { id: 'errors', label: 'Error log', icon: 'i-alert' }
  ];
  $scope.tabViews = $scope.mainViews;
  $scope.titles = {
    dashboard: 'Dashboard',
    checkin: 'Daily check-in',
    habits: 'Replacement habits',
    insights: 'Insights',
    forecast: 'Risk forecast',
    resources: 'Support and resources',
    errors: 'Error log'
  };
  $scope.moods = [
    { value: 1, short: 'Very low' },
    { value: 2, short: 'Low' },
    { value: 3, short: 'Okay' },
    { value: 4, short: 'Good' },
    { value: 5, short: 'Great' }
  ];
  $scope.triggers = ['Stress', 'Boredom', 'Loneliness', 'Social pressure', 'Other'];

  $scope.user = null;
  $scope.authMode = 'login';
  $scope.authForm = {};
  $scope.authError = '';
  $scope.busy = false;
  $scope.dark = false;
  $scope.view = 'dashboard';
  $scope.ui = { more: false, goal: false, relapse: null, confirm: null };
  $scope.loaded = false;
  $scope.goals = [];
  $scope.checkins = [];
  $scope.days = [];
  $scope.habits = [];
  $scope.resources = [];
  $scope.insights = null;
  $scope.forecast = null;
  $scope.errorSummary = { totalLogged: 0, totalOpen: 0, codesInCatalog: 0, codes: [] };
  $scope.errorLogs = [];
  $scope.errorFilter = { code: '' };
  $scope.selected = {};
  $scope.goalForm = {};
  $scope.habitForm = {};
  $scope.relapseForm = {};
  $scope.modalError = '';
  $scope.toast = null;
  $scope.checkinForm = newCheckin();

  var toastTimer = null;

  function newCheckin() {
    return { date: new Date(), mood: 3, craving: 0, trigger: '', note: '' };
  }

  function pad(n) {
    return ('0' + n).slice(-2);
  }

  function formatDay(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function readStore(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function writeStore(key, value) {
    try {
      if (value === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, value);
      }
    } catch (err) {
      return;
    }
  }

  function messageFor(err) {
    if (err.data && err.data.code) {
      return err.data.code + ': ' + err.data.error;
    }
    return 'Something went wrong. Check your connection and try again.';
  }

  function showToast(text, bad) {
    $scope.toast = { text: text, bad: !!bad };
    if (toastTimer) {
      $timeout.cancel(toastTimer);
    }
    toastTimer = $timeout(function() {
      $scope.toast = null;
    }, 4000);
  }

  function showError(err) {
    showToast(messageFor(err), true);
  }

  function clearData() {
    $scope.goals = [];
    $scope.checkins = [];
    $scope.days = [];
    $scope.habits = [];
    $scope.insights = null;
    $scope.forecast = null;
    $scope.errorLogs = [];
    $scope.selected = {};
    $scope.loaded = false;
  }

  function startSession(token, user) {
    writeStore('rt_token', token);
    $http.defaults.headers.common.Authorization = 'Bearer ' + token;
    $scope.user = user;
    $scope.authForm = {};
    $scope.authError = '';
    $scope.view = 'dashboard';
    $scope.loadGoals();
    $scope.loadResources();
  }

  $scope.setAuthMode = function(mode) {
    $scope.authMode = mode;
    $scope.authError = '';
  };

  $scope.submitAuth = function() {
    var path = $scope.authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    $scope.busy = true;
    $scope.authError = '';
    $http.post(path, $scope.authForm).then(function(res) {
      $scope.busy = false;
      startSession(res.data.token, res.data.user);
    }, function(err) {
      $scope.busy = false;
      $scope.authError = messageFor(err);
    });
  };

  $scope.signOut = function() {
    writeStore('rt_token', null);
    delete $http.defaults.headers.common.Authorization;
    $scope.user = null;
    $scope.ui.more = false;
    $scope.authMode = 'login';
    clearData();
  };

  $scope.$on('signedOut', function() {
    if ($scope.user) {
      $scope.signOut();
      $scope.authError = 'Your session ended. Please sign in again.';
    }
  });

  $scope.toggleDark = function() {
    $scope.dark = !$scope.dark;
    writeStore('rt_dark', $scope.dark ? '1' : '0');
  };

  $scope.initial = function() {
    return $scope.user ? $scope.user.name.charAt(0).toUpperCase() : '';
  };

  $scope.firstName = function() {
    return $scope.user ? $scope.user.name.split(' ')[0] : '';
  };

  $scope.greeting = function() {
    var hour = new Date().getHours();
    if (hour < 12) {
      return 'Good morning';
    }
    return hour < 18 ? 'Good afternoon' : 'Good evening';
  };

  $scope.todayLabel = function() {
    return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  };

  $scope.title = function() {
    return $scope.titles[$scope.view];
  };

  $scope.showsGoalPicker = function() {
    return ['checkin', 'habits', 'insights', 'forecast'].indexOf($scope.view) !== -1;
  };

  $scope.setView = function(id) {
    $scope.view = id;
    $scope.ui.more = false;
    if (id === 'errors') {
      $scope.loadErrors();
    }
    window.scrollTo(0, 0);
  };

  $scope.current = function() {
    for (var i = 0; i < $scope.goals.length; i++) {
      if ($scope.goals[i]._id === $scope.selected.goalId) {
        return $scope.goals[i];
      }
    }
    return null;
  };

  $scope.pick = function(goal) {
    $scope.selected.goalId = goal._id;
    $scope.loadGoalData();
  };

  $scope.ringOffset = function(progress) {
    return 515.2 * (1 - (progress || 0) / 100);
  };

  $scope.checkedToday = function() {
    var key = formatDay(new Date());
    return $scope.checkins.some(function(c) {
      return c.date.slice(0, 10) === key;
    });
  };

  function buildDays() {
    var out = [];
    for (var i = 13; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var key = formatDay(d);
      out.push({
        label: key,
        done: $scope.checkins.some(function(c) {
          return c.date.slice(0, 10) === key;
        })
      });
    }
    return out;
  }

  $scope.doneDays = function() {
    return $scope.days.filter(function(d) {
      return d.done;
    }).length;
  };

  $scope.sparkPoints = function(field) {
    var list = $scope.checkins.slice().reverse();
    if (list.length < 2) {
      return '';
    }
    return list.map(function(c, i) {
      var x = i * (300 / (list.length - 1));
      var y = field === 'craving' ? 80 - c.craving * 7 : 80 - (c.mood - 1) * 17.5;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
  };

  $scope.riskClass = function(level) {
    var classes = { high: 'chip-bad', medium: 'chip-warn', low: 'chip-good', unknown: 'chip-mute' };
    return classes[level];
  };

  $scope.riskLabel = function(level) {
    var labels = { high: 'High', medium: 'Medium', low: 'Low', unknown: 'Not enough data' };
    return labels[level];
  };

  $scope.loadGoals = function() {
    var today = formatDay(new Date());
    return $http.get('/api/goals?today=' + today).then(function(res) {
      $scope.goals = res.data;
      $scope.loaded = true;
      var stillThere = $scope.goals.some(function(g) {
        return g._id === $scope.selected.goalId;
      });
      if (!stillThere) {
        $scope.selected.goalId = $scope.goals.length ? $scope.goals[0]._id : null;
      }
      $scope.loadGoalData();
    }, showError);
  };

  $scope.loadGoalData = function() {
    if (!$scope.selected.goalId) {
      $scope.checkins = [];
      $scope.days = buildDays();
      $scope.habits = [];
      $scope.insights = null;
      $scope.forecast = null;
      return;
    }
    var id = $scope.selected.goalId;
    var today = formatDay(new Date());
    $http.get('/api/checkins?goalId=' + id).then(function(res) {
      $scope.checkins = res.data;
      $scope.days = buildDays();
    });
    $http.get('/api/habits?goalId=' + id).then(function(res) {
      $scope.habits = res.data;
    });
    $http.get('/api/insights?goalId=' + id + '&today=' + today).then(function(res) {
      $scope.insights = res.data;
    });
    $http.get('/api/forecast?goalId=' + id + '&today=' + today).then(function(res) {
      $scope.forecast = res.data;
    });
  };

  $scope.openGoal = function() {
    $scope.goalForm = { startDate: new Date() };
    $scope.modalError = '';
    $scope.ui.goal = true;
  };

  $scope.addGoal = function() {
    var data = {
      substance: $scope.goalForm.substance,
      startDate: $scope.goalForm.startDate ? formatDay($scope.goalForm.startDate) : '',
      costPerDay: $scope.goalForm.costPerDay,
      notes: $scope.goalForm.notes
    };
    $http.post('/api/goals', data).then(function(res) {
      $scope.ui.goal = false;
      $scope.selected.goalId = res.data._id;
      showToast('Goal saved. Day 1 starts now.');
      $scope.loadGoals();
    }, function(err) {
      $scope.modalError = messageFor(err);
    });
  };

  $scope.askRemoveGoal = function(goal) {
    $scope.ui.confirm = {
      title: 'Delete "' + goal.substance + '"?',
      text: 'This removes the goal with all of its check-ins and habits. It cannot be undone.',
      button: 'Delete',
      action: function() {
        $http.delete('/api/goals/' + goal._id).then(function() {
          showToast('Goal deleted');
          $scope.loadGoals();
        }, showError);
      }
    };
  };

  $scope.runConfirm = function() {
    var action = $scope.ui.confirm.action;
    $scope.ui.confirm = null;
    action();
  };

  $scope.openRelapse = function(goal) {
    $scope.relapseForm = {};
    $scope.modalError = '';
    $scope.ui.relapse = goal;
  };

  $scope.logRelapse = function() {
    var goal = $scope.ui.relapse;
    var data = { date: formatDay(new Date()), note: $scope.relapseForm.note };
    $http.post('/api/goals/' + goal._id + '/relapse', data).then(function() {
      $scope.ui.relapse = null;
      showToast('Logged. Day 1 starts today and your best streak is saved.');
      $scope.loadGoals();
    }, function(err) {
      $scope.modalError = messageFor(err);
    });
  };

  $scope.toggleTrigger = function(name) {
    $scope.checkinForm.trigger = $scope.checkinForm.trigger === name ? '' : name;
  };

  $scope.saveCheckin = function() {
    var form = $scope.checkinForm;
    var data = {
      goalId: $scope.selected.goalId,
      date: form.date ? formatDay(form.date) : '',
      mood: form.mood,
      craving: Number(form.craving),
      trigger: form.trigger,
      note: form.note
    };
    $scope.busy = true;
    $http.post('/api/checkins', data).then(function() {
      $scope.busy = false;
      $scope.checkinForm = newCheckin();
      showToast('Check-in saved. Nice work showing up.');
      $scope.loadGoals();
    }, function(err) {
      $scope.busy = false;
      showError(err);
    });
  };

  $scope.addHabit = function() {
    var data = { goalId: $scope.selected.goalId, name: $scope.habitForm.name };
    $http.post('/api/habits', data).then(function() {
      $scope.habitForm = {};
      showToast('Habit added');
      $scope.loadGoalData();
    }, showError);
  };

  $scope.useHabit = function(habit) {
    $http.post('/api/habits/' + habit._id + '/use').then(function() {
      showToast('That counts as a win.');
      $scope.loadGoalData();
    }, showError);
  };

  $scope.removeHabit = function(habit) {
    $http.delete('/api/habits/' + habit._id).then(function() {
      $scope.loadGoalData();
    }, showError);
  };

  $scope.loadResources = function() {
    $http.get('/api/resources').then(function(res) {
      $scope.resources = res.data;
    });
  };

  $scope.loadErrors = function() {
    $http.get('/api/errors/summary').then(function(res) {
      $scope.errorSummary = res.data;
    });
    var query = $scope.errorFilter.code ? '?code=' + $scope.errorFilter.code : '';
    $http.get('/api/errors' + query).then(function(res) {
      $scope.errorLogs = res.data;
    });
  };

  $scope.resolveError = function(log) {
    $http.post('/api/errors/' + log._id + '/resolve').then(function() {
      showToast('Marked ' + log.code + ' as resolved');
      $scope.loadErrors();
    }, showError);
  };

  $scope.clearResolved = function() {
    $http.delete('/api/errors/resolved').then(function(res) {
      showToast('Removed ' + res.data.removed + ' resolved entries');
      $scope.errorFilter.code = '';
      $scope.loadErrors();
    }, showError);
  };

  $scope.dark = readStore('rt_dark') === '1';
  var saved = readStore('rt_token');
  if (saved) {
    $http.defaults.headers.common.Authorization = 'Bearer ' + saved;
    $http.get('/api/auth/me').then(function(res) {
      startSession(saved, res.data.user);
    }, function() {
      writeStore('rt_token', null);
      delete $http.defaults.headers.common.Authorization;
    });
  }
});
