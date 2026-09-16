const morgan = require('morgan');
const logger = require('../utils/logger');

// E-posta doğrulama linki token'ı query string'de geliyor; :url onu düz metin
// loglardı, bu yüzden parametreler maskeleniyor.
morgan.token('safe-url', (req) => {
  const [pathname, query] = (req.originalUrl || req.url).split('?');
  if (!query) return pathname;
  const params = new URLSearchParams(query);
  for (const key of params.keys()) {
    params.set(key, '[REDACTED]');
  }
  return `${pathname}?${params.toString()}`;
});

morgan.token('safe-body', (req) => {
  if (!req.body || Object.keys(req.body).length === 0) return '-';
  return JSON.stringify(logger.redact(req.body));
});

const format = ':method :safe-url :status :res[content-length] - :response-time ms :safe-body';

module.exports = morgan(format, {
  stream: { write: (line) => logger.info(line.trim()) },
});
