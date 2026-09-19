/**
 * HTTP istek logu.
 *
 * morgan'ın hazır formatları ("combined", "dev") bu proje için doğrudan
 * kullanılamıyordu: ikisi de URL'i ve gövdeyi olduğu gibi yazıyor. Oysa
 * e-posta doğrulama bağlantısındaki token query string'de geliyor, giriş
 * isteğinin gövdesinde de şifre var. Bu yüzden iki özel token tanımlandı,
 * çıktı da logger üzerinden geçirilerek tek biçimde tutuldu.
 */
const morgan = require('morgan');
const logger = require('../utils/logger');

// Query string'deki bütün değerler maskeleniyor. Yalnızca "token" anahtarını
// maskelemek yeterli görünüyor ama ileride eklenecek başka bir parametrenin
// gözden kaçmaması için anahtar adına bakılmıyor; hepsi gizleniyor.
// Anahtar isimleri kalıyor, böylece log yine de okunabilir oluyor.
morgan.token('safe-url', (req) => {
  const [pathname, query] = (req.originalUrl || req.url).split('?');
  if (!query) return pathname;
  const params = new URLSearchParams(query);
  for (const key of params.keys()) {
    params.set(key, '[REDACTED]');
  }
  return `${pathname}?${params.toString()}`;
});

// Gövde, logger'ın maskeleme kurallarından geçiriliyor; şifre ve token alanları
// aynı listeden yönetilsin, iki ayrı yerde güncellenmesi gerekmesin diye.
morgan.token('safe-body', (req) => {
  if (!req.body || Object.keys(req.body).length === 0) return '-';
  return JSON.stringify(logger.redact(req.body));
});

const format = ':method :safe-url :status :res[content-length] - :response-time ms :safe-body';

// morgan doğrudan stdout'a yazmak yerine logger'a yönlendiriliyor: böylece
// istek logları da uygulama loglarıyla aynı biçimde ve aynı akışta çıkıyor.
module.exports = morgan(format, {
  stream: { write: (line) => logger.info(line.trim()) },
});
