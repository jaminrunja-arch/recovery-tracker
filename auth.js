const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const AppError = require('./errors/appError');

const weekMs = 7 * 24 * 60 * 60 * 1000;

function loadSecret() {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  const file = path.join(process.env.DATA_DIR || __dirname, '.session-secret');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch (err) {
    const made = crypto.randomBytes(32).toString('hex');
    try {
      fs.writeFileSync(file, made, { mode: 0o600 });
    } catch (writeError) {
      console.log('Could not save the session secret, sessions will end when the server restarts');
    }
    return made;
  }
}

const secret = loadSecret();

function hashPassword(password) {
  return new Promise(function(resolve, reject) {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, 64, function(err, key) {
      if (err) {
        return reject(err);
      }
      resolve(salt.toString('hex') + ':' + key.toString('hex'));
    });
  });
}

function checkPassword(password, stored) {
  return new Promise(function(resolve, reject) {
    const parts = String(stored).split(':');
    if (parts.length !== 2) {
      return resolve(false);
    }
    const salt = Buffer.from(parts[0], 'hex');
    const expected = Buffer.from(parts[1], 'hex');
    crypto.scrypt(password, salt, 64, function(err, key) {
      if (err) {
        return reject(err);
      }
      resolve(key.length === expected.length && crypto.timingSafeEqual(key, expected));
    });
  });
}

function signature(body) {
  return crypto.createHmac('sha256', secret).update(body).digest('base64url');
}

function makeToken(userId, now) {
  const body = Buffer.from(JSON.stringify({ uid: String(userId), exp: (now || Date.now()) + weekMs })).toString('base64url');
  return body + '.' + signature(body);
}

function readToken(token, now) {
  if (typeof token !== 'string') {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const expected = Buffer.from(signature(parts[0]));
  const given = Buffer.from(parts[1]);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (typeof data.uid !== 'string' || typeof data.exp !== 'number' || data.exp < (now || Date.now())) {
      return null;
    }
    return data.uid;
  } catch (err) {
    return null;
  }
}

function requireUser(req, res, next) {
  const header = req.headers.authorization || '';
  const match = /^Bearer (.+)$/.exec(header);
  const userId = match ? readToken(match[1]) : null;
  if (!userId) {
    return next(new AppError('E606'));
  }
  req.userId = userId;
  next();
}

module.exports = {
  hashPassword: hashPassword,
  checkPassword: checkPassword,
  makeToken: makeToken,
  readToken: readToken,
  requireUser: requireUser
};
