import http.client
import json
import time
import urllib.parse
from datetime import date, datetime, timedelta, timezone


def today():
    return datetime.now(timezone.utc).date()


def day(n):
    return (today() - timedelta(days=n)).isoformat()


class Api:
    def __init__(self, base):
        u = urllib.parse.urlparse(base)
        self.base = base
        self.host = u.hostname
        self.port = u.port
        self.token = None
        self.email = None

    def login(self, name='Attacker'):
        self.email = 'attack%d%d@example.com' % (int(time.time() * 1000), id(self) % 1000)
        r = self.call('POST', '/api/auth/register', {'name': name, 'email': self.email, 'password': 'attackpass1'})
        if r['status'] != 200:
            raise SystemExit('could not create the test account: %s' % r['text'])
        self.token = r['body']['token']

    def call(self, method, path, body=None, raw=None, headers=None, timeout=90):
        data = raw if raw is not None else (json.dumps(body) if body is not None else None)
        h = {'Content-Type': 'application/json'}
        if self.token:
            h['Authorization'] = 'Bearer ' + self.token
        h.update(headers or {})
        started = time.time()
        conn = http.client.HTTPConnection(self.host, self.port, timeout=timeout)
        try:
            conn.request(method, path, body=data, headers=h)
            r = conn.getresponse()
            text = r.read().decode('utf-8', 'replace')
            ms = (time.time() - started) * 1000
            try:
                parsed = json.loads(text)
            except ValueError:
                parsed = text
            return {'status': r.status, 'body': parsed, 'text': text, 'ms': ms, 'headers': dict(r.getheaders())}
        except Exception as e:
            ms = (time.time() - started) * 1000
            return {'status': 0, 'body': str(e), 'text': str(e), 'ms': ms, 'headers': {}}
        finally:
            conn.close()

    def alive(self):
        return self.call('GET', '/api/resources')['status'] == 200


def code_of(r):
    if isinstance(r['body'], dict):
        return r['body'].get('code', '')
    return ''
