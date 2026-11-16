import json
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from lib import Api, code_of, day, today

import os

attack_dir = os.path.dirname(os.path.abspath(__file__))
base = sys.argv[1]
label = sys.argv[2]
outdir = sys.argv[3]
wanted = [int(x) for x in sys.argv[4].split(',')]
api = Api(base)
api.login()
created = []
ctx = {}


def make_goal(name, start=60):
    r = api.call('POST', '/api/goals', {'substance': name, 'startDate': day(start), 'costPerDay': 5})
    if r['status'] == 200:
        created.append(r['body']['_id'])
    return r


def make_checkin(goal, age, craving=3):
    return api.call('POST', '/api/checkins', {'goalId': goal, 'date': day(age), 'mood': 3, 'craving': craving, 'trigger': 'Stress', 'note': ''})


def setup(fillers):
    a = make_goal('Attack A')['body']['_id']
    b = make_goal('Attack B')['body']['_id']
    for g in (a, b):
        for age in (1, 2, 3):
            make_checkin(g, age)
    for i in range(fillers):
        g = make_goal('Filler %d' % i)['body']['_id']
        for age in range(1, 15):
            make_checkin(g, age, (age * 3) % 10)
    ctx['a'] = a
    ctx['b'] = b


def cleanup():
    for g in created:
        api.call('DELETE', '/api/goals/' + g)


def finish(num, title, lines, checks):
    ok = sum(1 for c in checks if c[1])
    result = 'PASS' if ok == len(checks) else 'FAIL'
    lines.append('')
    lines.append('CASE %d RESULT: %s (%d of %d checks passed). Server still answering: %s' % (num, result, ok, len(checks), 'yes' if api.alive() else 'NO'))
    open('%s/case%d.txt' % (outdir, num), 'w').write('\n'.join(lines) + '\n')
    print('\n'.join(lines))
    return {'case': num, 'title': title, 'result': result, 'passed': ok, 'total': len(checks), 'checks': [{'text': c[0], 'ok': c[1], 'detail': c[2]} for c in checks]}


def check(lines, checks, text, ok, detail):
    lines.append('[%s] %s: %s' % ('PASS' if ok else 'FAIL', text, detail))
    checks.append((text, ok, detail))


def case1():
    lines = ['$ npx autocannon -c 100 -d 10 %s/...   (100 users at once for 10 seconds)' % base, '']
    checks = []
    targets = [('Dashboard (GET /api/goals)', '/api/goals?today=%s' % today()),
               ('Insights (GET /api/insights)', '/api/insights?goalId=%s&today=%s' % (ctx['a'], today())),
               ('Forecast (GET /api/forecast)', '/api/forecast?goalId=%s&today=%s' % (ctx['a'], today()))]
    stats = []
    for name, path in targets:
        out = subprocess.run(['npx', 'autocannon', '-c', '100', '-d', '10', '-j', '-H', 'Authorization=Bearer ' + api.token, base + path], cwd=attack_dir, capture_output=True, text=True)
        try:
            d = json.loads(out.stdout)
        except ValueError:
            check(lines, checks, name, False, 'load tool produced no result')
            continue
        ok = d['errors'] == 0 and d['timeouts'] == 0 and d['non2xx'] == 0 and d['latency']['p99'] < 2000
        detail = '%d req/s, p99 latency %d ms, %d total, %d errors, %d timeouts, %d non-2xx' % (
            d['requests']['average'], d['latency']['p99'], d['requests']['total'], d['errors'], d['timeouts'], d['non2xx'])
        stats.append({'name': name, 'rps': d['requests']['average'], 'p99': d['latency']['p99'], 'total': d['requests']['total'], 'errors': d['errors'], 'timeouts': d['timeouts'], 'non2xx': d['non2xx']})
        check(lines, checks, name, ok, detail)
    r = finish(1, 'Many users at once', lines, checks)
    r['stats'] = stats
    return r


def case2():
    total = 4000
    lines = ['$ python3 api_attacks.py %s   (4000 bad requests, 20 at a time)' % base, '']
    checks = []
    body = {'goalId': ctx['a'], 'date': str(today()), 'mood': 99, 'craving': 3}
    started = time.time()
    with ThreadPoolExecutor(20) as ex:
        results = list(ex.map(lambda _: api.call('POST', '/api/checkins', body), range(total)))
    seconds = time.time() - started
    counts = {}
    for r in results:
        counts[r['status']] = counts.get(r['status'], 0) + 1
    lines.append('Sent %d requests in %.1f seconds. Responses by status: %s' % (total, seconds, json.dumps(counts, sort_keys=True)))
    waited = 0
    summary = api.call('GET', '/api/errors/summary')
    while summary['status'] == 429 and waited < 90:
        time.sleep(2)
        waited += 2
        summary = api.call('GET', '/api/errors/summary')
    lines.append('Seconds until the app answered a normal request again after the flood: %d' % waited)
    logged = summary['body'].get('totalLogged', -1) if isinstance(summary['body'], dict) else -1
    listing = api.call('GET', '/api/errors')
    lines.append('Registry now holds %s entries. GET /api/errors/summary took %d ms. GET /api/errors took %d ms.' % (logged, summary['ms'], listing['ms']))
    check(lines, checks, 'Registry stays small', 0 <= logged <= 500, '%s entries saved after %d bad requests (limit 500)' % (logged, total))
    check(lines, checks, 'Flood is slowed down', counts.get(429, 0) > 0, '%d requests answered 429 Too Many Requests' % counts.get(429, 0))
    check(lines, checks, 'Registry still loads quickly', summary['status'] == 200 and summary['ms'] < 1000, 'summary answered %d in %d ms' % (summary['status'], summary['ms']))
    r = finish(2, 'Request flood', lines, checks)
    r['stats'] = {'sent': total, 'seconds': round(seconds, 1), 'statuses': counts, 'logged': logged, 'summary_ms': int(summary['ms'])}
    return r


def total_checkins(goal):
    r = api.call('GET', '/api/insights?goalId=%s&today=%s' % (goal, today()))
    return r['body']['totalCheckIns'] if isinstance(r['body'], dict) else -1


def case3():
    lines = ['$ 30 identical check-in requests released at the same instant, three rounds', '']
    checks = []
    goal = make_goal('Race goal')['body']['_id']
    stored_all = []
    for age in (1, 2, 3):
        n = 30
        before = total_checkins(goal)
        barrier = threading.Barrier(n)

        def worker(_):
            barrier.wait()
            return api.call('POST', '/api/checkins', {'goalId': goal, 'date': day(age), 'mood': 3, 'craving': 4})
        with ThreadPoolExecutor(n) as ex:
            results = list(ex.map(worker, range(n)))
        statuses = {}
        for r in results:
            statuses[r['status']] = statuses.get(r['status'], 0) + 1
        stored = total_checkins(goal) - before
        stored_all.append(stored)
        check(lines, checks, 'Round %d, check-in for %s' % (age, day(age)), stored == 1, '%d stored (answers %s)' % (stored, json.dumps(statuses, sort_keys=True)))
    habits = api.call('GET', '/api/habits?goalId=' + goal)['body']
    habit = habits[0]['_id']
    with ThreadPoolExecutor(25) as ex:
        results = list(ex.map(lambda _: api.call('POST', '/api/habits/%s/use' % habit), range(100)))
    accepted = len([r for r in results if r['status'] == 200])
    after = [h for h in api.call('GET', '/api/habits?goalId=' + goal)['body'] if h['_id'] == habit][0]
    check(lines, checks, '100 simultaneous "I used this" presses', after['timesUsed'] == accepted, '%d presses answered 200, counter says %d' % (accepted, after['timesUsed']))
    r = finish(3, 'Simultaneous duplicate requests', lines, checks)
    r['stats'] = {'stored': stored_all, 'accepted': accepted, 'timesUsed': after['timesUsed']}
    return r


def case4():
    lines = ['$ keep creating data until the app says stop', '']
    checks = []
    accepted = 0
    last = None
    for i in range(120):
        r = api.call('POST', '/api/goals', {'substance': 'Growth %d' % i, 'startDate': day(30), 'costPerDay': 1})
        if r['status'] == 200:
            created.append(r['body']['_id'])
            accepted += 1
        else:
            last = r
    dash = api.call('GET', '/api/goals?today=%s' % today())
    refusal = ('%s %s' % (last['status'], code_of(last))) if last else 'never refused'
    check(lines, checks, '120 goals requested', accepted <= 25, '%d accepted, refusal: %s, dashboard now takes %d ms' % (accepted, refusal, dash['ms']))

    habits_ok = 0
    last = None
    for i in range(200):
        r = api.call('POST', '/api/habits', {'goalId': ctx['a'], 'name': 'Habit %d' % i})
        if r['status'] == 200:
            habits_ok += 1
        else:
            last = r
    total_habits = len(api.call('GET', '/api/habits?goalId=' + ctx['a'])['body'])
    check(lines, checks, '200 habits requested for one goal', total_habits <= 30, '%d habits stored (5 are defaults), refusal: %s' % (total_habits, ('%s %s' % (last['status'], code_of(last))) if last else 'never refused'))

    stored = 0
    last = None
    for i in range(200):
        r = api.call('POST', '/api/goals/%s/relapse' % ctx['a'], {'date': day(1), 'note': 'spam'})
        if r['status'] == 200:
            stored = len(r['body']['relapses'])
        else:
            last = r
    check(lines, checks, '200 relapses requested for one goal', stored <= 50, '%d relapses stored, refusal: %s' % (stored, ('%s %s' % (last['status'], code_of(last))) if last else 'never refused'))

    big = 'x' * 5000
    r1 = api.call('POST', '/api/goals', {'substance': 'Text test', 'startDate': day(5), 'notes': big})
    if r1['status'] == 200:
        created.append(r1['body']['_id'])
    check(lines, checks, 'Goal notes of 5000 characters', r1['status'] == 400, 'status %d %s' % (r1['status'], code_of(r1)))
    r2 = api.call('POST', '/api/goals', {'substance': big, 'startDate': day(5)})
    if r2['status'] == 200:
        created.append(r2['body']['_id'])
    check(lines, checks, 'Substance name of 5000 characters', r2['status'] == 400, 'status %d %s' % (r2['status'], code_of(r2)))
    r3 = api.call('POST', '/api/checkins', {'goalId': ctx['b'], 'date': day(9), 'mood': 3, 'craving': 3, 'note': big})
    check(lines, checks, 'Check-in note of 5000 characters', r3['status'] == 400, 'status %d %s' % (r3['status'], code_of(r3)))
    r = finish(4, 'Unbounded growth', lines, checks)
    r['stats'] = {'goals': accepted, 'habits': total_habits, 'relapses': stored, 'dashboard_ms': int(dash['ms'])}
    return r


def case5():
    lines = ['$ POST /api/goals with a 300 KB JSON body', '']
    checks = []
    r = api.call('POST', '/api/goals', {'substance': 'Big', 'startDate': day(5), 'notes': 'n' * 300000})
    check(lines, checks, 'Oversized body', r['status'] in (400, 413), 'status %d %s %s' % (r['status'], code_of(r), r['body'].get('error', '') if isinstance(r['body'], dict) else ''))
    r2 = api.call('POST', '/api/goals', None, raw='{"substance": "' + 'y' * 9000 + '"}')
    check(lines, checks, 'Body of 9 KB (still allowed by size)', r2['status'] != 500, 'status %d %s' % (r2['status'], code_of(r2)))
    check(lines, checks, 'App still healthy after the big body', api.call('GET', '/api/goals?today=%s' % today())['status'] == 200, 'dashboard request answered')
    return finish(5, 'Oversized request body', lines, checks)


def case6():
    a, b = ctx['a'], ctx['b']
    lines = ['$ operator injection: ?goalId[$ne]=<goal A> asks for "every goal except A"', '']
    checks = []
    probes = [
        ('GET', '/api/checkins?goalId[$ne]=%s' % a, 'check-ins'),
        ('GET', '/api/checkins?goalId[$gt]=000000000000000000000000', 'check-ins'),
        ('GET', '/api/habits?goalId[$ne]=%s' % a, 'habits'),
        ('GET', '/api/insights?goalId[$ne]=%s&today=%s' % (a, today()), 'insights'),
        ('GET', '/api/forecast?goalId[$ne]=%s&today=%s' % (a, today()), 'forecast'),
        ('GET', '/api/errors?code[$ne]=zzz', 'errors'),
        ('GET', '/api/errors?code[$regex]=.*', 'errors'),
    ]
    for method, path, what in probes:
        r = api.call(method, path)
        leaked = r['status'] == 200 and ((isinstance(r['body'], list) and len(r['body']) > 0) or (isinstance(r['body'], dict) and 'totalCheckIns' in r['body']))
        short = path.split('?')[0] + '?' + path.split('?')[1].split('&')[0]
        check(lines, checks, short, not leaked, 'status %d %s%s' % (r['status'], code_of(r), (', the operator was applied and data came back' if leaked else '')))
    r = api.call('POST', '/api/checkins', {'goalId': {'$ne': None}, 'date': day(20), 'mood': 3, 'craving': 3})
    check(lines, checks, 'POST /api/checkins with goalId {"$ne": null}', r['status'] != 200, 'status %d %s' % (r['status'], code_of(r)))
    r = api.call('POST', '/api/habits', {'goalId': {'$ne': None}, 'name': 'inject'})
    check(lines, checks, 'POST /api/habits with goalId {"$ne": null}', r['status'] != 200, 'status %d %s' % (r['status'], code_of(r)))
    return finish(6, 'Operator injection', lines, checks)


def case7():
    a = ctx['a']
    ghost = '64b7f0f0f0f0f0f0f0f0f0f0'
    lines = ['$ wrong types, extra fields and records for goals that do not exist', '']
    checks = []

    def rejected(text, r):
        check(lines, checks, text, r['status'] in (400, 404, 409), 'status %d %s' % (r['status'], code_of(r)))

    rejected('mood sent as true', api.call('POST', '/api/checkins', {'goalId': a, 'date': day(30), 'mood': True, 'craving': 3}))
    rejected('mood sent as [3]', api.call('POST', '/api/checkins', {'goalId': a, 'date': day(31), 'mood': [3], 'craving': 3}))
    rejected('craving sent as an object', api.call('POST', '/api/checkins', {'goalId': a, 'date': day(32), 'mood': 3, 'craving': {'a': 1}}))
    rejected('trigger that is not on the list', api.call('POST', '/api/checkins', {'goalId': a, 'date': day(33), 'mood': 3, 'craving': 3, 'trigger': 'DROP TABLE goals'}))
    rejected('check-in for a goal that does not exist', api.call('POST', '/api/checkins', {'goalId': ghost, 'date': day(1), 'mood': 3, 'craving': 3}))
    rejected('habit for a goal that does not exist', api.call('POST', '/api/habits', {'goalId': ghost, 'name': 'Orphan'}))
    old = api.call('POST', '/api/goals', {'substance': 'Old', 'startDate': '0001-01-01'})
    if old['status'] == 200:
        created.append(old['body']['_id'])
    rejected('start date in the year 0001', old)
    extra = api.call('POST', '/api/goals', {'substance': 'Extra', 'startDate': day(5), 'relapses': [{'date': '2020-01-01', 'note': 'planted'}], '_id': '64b7f0f0f0f0f0f0f0f0f0f1', '__v': 9})
    if extra['status'] == 200:
        created.append(extra['body']['_id'])
    ok = extra['status'] == 200 and extra['body']['relapses'] == [] and extra['body']['_id'] != '64b7f0f0f0f0f0f0f0f0f0f1'
    check(lines, checks, 'extra fields (relapses, _id) are ignored', ok, 'status %d, relapses %s, _id kept as sent: %s' % (extra['status'], extra['body'].get('relapses') if isinstance(extra['body'], dict) else '?', 'yes' if isinstance(extra['body'], dict) and extra['body'].get('_id') == '64b7f0f0f0f0f0f0f0f0f0f1' else 'no'))
    return finish(7, 'Wrong types, extra fields and orphan records', lines, checks)


def case8():
    lines = ['$ curl --path-as-is  (asking the static file server for files outside public/)', '']
    checks = []
    paths = ['/vendor/angular/../../server.js', '/vendor/angular/%2e%2e/%2e%2e/server.js', '/vendor/bootstrap/..%2f..%2f..%2fpackage.json',
             '/..%2fserver.js', '/../server.js', '/.env', '/server.js', '/package.json', '/node_modules/express/package.json', '/errors/catalog.js']
    for p in paths:
        r = api.call('GET', p)
        leaked = r['status'] == 200 and ('require(' in r['text'] or '"dependencies"' in r['text'] or 'entries' in r['text'])
        check(lines, checks, p, not leaked, 'status %d%s' % (r['status'], ', SOURCE FILE RETURNED' if leaked else ''))
    return finish(8, 'Path traversal on static files', lines, checks)


def case14():
    lines = ['$ access control: no token, forged tokens, another user, login abuse', '']
    checks = []
    other = Api(base)
    other.login('Other User')
    goal = ctx['a']
    guarded = ['/api/goals', '/api/checkins?goalId=' + goal, '/api/habits?goalId=' + goal, '/api/insights?goalId=' + goal, '/api/forecast?goalId=' + goal, '/api/errors', '/api/errors/summary', '/api/auth/me']
    anon = Api(base)
    for path in guarded:
        r = anon.call('GET', path)
        check(lines, checks, 'No token: GET %s' % path.split('?')[0], r['status'] == 401 and code_of(r) == 'E606', 'status %d %s' % (r['status'], code_of(r)))
    good = api.token
    parts = good.split('.')
    forged = anon
    forged.token = parts[0] + '.' + parts[1][:-2] + 'xx'
    r = forged.call('GET', '/api/goals')
    check(lines, checks, 'Token with a damaged signature', r['status'] == 401, 'status %d %s' % (r['status'], code_of(r)))
    import base64
    body = json.loads(base64.urlsafe_b64decode(parts[0] + '=' * (-len(parts[0]) % 4)))
    body['uid'] = '64b7f0f0f0f0f0f0f0f0f0f0'
    swapped = base64.urlsafe_b64encode(json.dumps(body).encode()).decode().rstrip('=')
    forged.token = swapped + '.' + parts[1]
    r = forged.call('GET', '/api/goals')
    check(lines, checks, 'Token with the user id swapped for another', r['status'] == 401, 'status %d %s' % (r['status'], code_of(r)))
    forged.token = 'none'
    r = forged.call('GET', '/api/goals')
    check(lines, checks, 'Token that is just the word none', r['status'] == 401, 'status %d %s' % (r['status'], code_of(r)))
    habit = api.call('GET', '/api/habits?goalId=' + goal)['body'][0]['_id']
    attempts = [
        ('GET', '/api/checkins?goalId=' + goal, None),
        ('GET', '/api/habits?goalId=' + goal, None),
        ('GET', '/api/insights?goalId=' + goal, None),
        ('GET', '/api/forecast?goalId=' + goal, None),
        ('POST', '/api/checkins', {'goalId': goal, 'date': day(20), 'mood': 3, 'craving': 3}),
        ('POST', '/api/habits', {'goalId': goal, 'name': 'Sneaky'}),
        ('POST', '/api/habits/%s/use' % habit, {}),
        ('DELETE', '/api/habits/' + habit, None),
        ('POST', '/api/goals/%s/relapse' % goal, {'date': day(0)}),
        ('DELETE', '/api/goals/' + goal, None)
    ]
    for method, path, body in attempts:
        r = other.call(method, path, body)
        check(lines, checks, 'Other user: %s %s' % (method, path.split('?')[0].replace(goal, ':goal').replace(habit, ':habit')), r['status'] == 404, 'status %d %s' % (r['status'], code_of(r)))
    still = api.call('GET', '/api/goals')['body']
    check(lines, checks, 'Owner still has every goal after those attempts', any(g['_id'] == goal for g in still), '%d goals listed' % len(still))
    seen = other.call('GET', '/api/goals')['body']
    check(lines, checks, 'Other user sees none of the owner goals', not any(g['_id'] == goal for g in seen), '%d goals listed' % len(seen))
    r = Api(base).call('POST', '/api/auth/login', {'email': {'$ne': None}, 'password': 'x'})
    check(lines, checks, 'Login with an operator instead of an email', r['status'] == 401 and 'token' not in r['text'], 'status %d %s' % (r['status'], code_of(r)))
    r = Api(base).call('POST', '/api/auth/register', {'name': 'Copy', 'email': api.email.upper(), 'password': 'attackpass1'})
    check(lines, checks, 'Same email in capital letters is refused', r['status'] == 409 and code_of(r) == 'E604', 'status %d %s' % (r['status'], code_of(r)))
    r = Api(base).call('POST', '/api/auth/register', {'name': 'Long', 'email': 'long@example.com', 'password': 'x' * 5000})
    check(lines, checks, 'Password of 5000 characters is refused', r['status'] == 400 and code_of(r) == 'E603', 'status %d %s' % (r['status'], code_of(r)))
    me = api.call('GET', '/api/auth/me')
    leaked = 'passwordHash' in me['text'] or 'attackpass1' in me['text']
    check(lines, checks, 'Account response never contains the password or its hash', not leaked, me['text'][:90])
    codes = {}
    for i in range(40):
        r = Api(base).call('POST', '/api/auth/login', {'email': api.email, 'password': 'wrong-%d' % i})
        codes[r['status']] = codes.get(r['status'], 0) + 1
    check(lines, checks, 'Password guessing is slowed down', codes.get(429, 0) > 0 and codes.get(200, 0) == 0, 'answers %s' % json.dumps(codes, sort_keys=True))
    return finish(14, 'Access control and accounts', lines, checks)


cases = {1: case1, 2: case2, 3: case3, 4: case4, 5: case5, 6: case6, 7: case7, 8: case8, 14: case14}
filler = 8 if 1 in wanted else 0
setup(filler)
results = []
for n in wanted:
    results.append(cases[n]())
    print()
cleanup()
path = '%s/results_%s.json' % (outdir, '_'.join(str(n) for n in wanted))
json.dump(results, open(path, 'w'), indent=1)
