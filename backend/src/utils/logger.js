const env = require('../config/env');

// Loglara sızmaması gereken alan adları.
const SENSITIVE_KEYS = new Set([
  'password', 'newpassword', 'currentpassword',
  'token', 'idtoken', 'accesstoken', 'refreshtoken', 'csrftoken',
  'authorization', 'cookie', 'secret', 'privatekey', 'apikey',
]);

function redact(value, depth = 0) {
  if (depth > 4 || value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }
  const output = {};
  for (const [key, val] of Object.entries(value)) {
    output[key] = SENSITIVE_KEYS.has(key.toLowerCase())
      ? '[REDACTED]'
      : redact(val, depth + 1);
  }
  return output;
}

function write(level, message, context = {}) {
  const entry = {
    time: new Date().toISOString(),
    level,
    message,
    ...redact(context),
  };

  // Production'da tek satır JSON, development'ta okunaklı çıktı.
  const line = env.isProduction
    ? JSON.stringify(entry)
    : `${entry.time} [${level.toUpperCase()}] ${message}` +
      (Object.keys(context).length ? ` ${JSON.stringify(redact(context))}` : '');

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

module.exports = {
  redact,
  debug: (message, context) => { if (!env.isProduction) write('debug', message, context); },
  info: (message, context) => write('info', message, context),
  warn: (message, context) => write('warn', message, context),
  error: (message, context) => write('error', message, context),
};
