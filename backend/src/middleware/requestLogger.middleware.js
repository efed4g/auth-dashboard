/**
 * HTTP istek logu.
 *
 * morgan'ın hazır formatları URL'i ve gövdeyi olduğu gibi yazıyor; oysa
 * doğrulama bağlantısındaki token query string'de, şifre de giriş gövdesinde
 * geliyor. Bu yüzden iki maskeleyen token tanımlandı.
 */
const morgan = require('morgan');
const logger = require('../utils/logger');
const env = require('../config/env');

// Anahtar adına bakılmadan tüm değerler maskeleniyor: ileride eklenecek bir
// parametre gözden kaçmasın. Anahtar isimleri kalıyor, log okunabilir oluyor.
morgan.token('safe-url', (req) => {
  const [pathname, query] = (req.originalUrl || req.url).split('?');
  if (!query) return pathname;
  const params = new URLSearchParams(query);
  for (const key of params.keys()) {
    params.set(key, '[REDACTED]');
  }
  return `${pathname}?${params.toString()}`;
});

// Gövde logger'ın maskeleme kurallarından geçiyor: hassas alan listesi tek yerde.
morgan.token('safe-body', (req) => {
  if (!req.body || Object.keys(req.body).length === 0) return '-';
  return JSON.stringify(logger.redact(req.body));
});

const format = ':method :safe-url :status :res[content-length] - :response-time ms :safe-body';

// stdout yerine logger'a yazılıyor ki istek logları uygulama loglarıyla aynı
// biçimde çıksın.
module.exports = morgan(format, {
  stream: { write: (line) => logger.info(line.trim()) },
  // Testlerde atlanıyor: her istek satırı Jest çıktısını okunmaz hale
  // getiriyor ve orada okunacak bir istek logu zaten yok.
  skip: () => env.nodeEnv === 'test',
});
