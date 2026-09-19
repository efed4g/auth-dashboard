/**
 * Basit yapılandırılmış logger.
 *
 * console.log'u doğrudan çağırmak yerine bu katmanı koymamın iki sebebi var:
 * hassas alanların otomatik maskelenmesi ve çıktının ortama göre biçim
 * değiştirebilmesi. Gerçek bir projede winston/pino tercih edilirdi; bu
 * ölçekte bağımlılık eklemeye değmedi ama arayüz benzer tutuldu, yani
 * ileride değiştirmek çağrı noktalarını etkilemez.
 */
const env = require('../config/env');

// Log'a asla düz metin düşmemesi gereken alanlar. Anahtarlar küçük harfe
// çevrilerek karşılaştırıldığı için "idToken" ve "idtoken" aynı sayılıyor.
const SENSITIVE_KEYS = new Set([
  'password', 'newpassword', 'currentpassword',
  'token', 'idtoken', 'accesstoken', 'refreshtoken', 'csrftoken',
  'authorization', 'cookie', 'secret', 'privatekey', 'apikey',
]);

/**
 * Nesneyi kopyalayarak hassas alanları maskeler.
 *
 * Özyinelemeli çalışıyor çünkü hassas veri çoğu zaman iç içe geliyor
 * (ör. { body: { password } }). depth sınırı, kendine referans veren
 * nesnelerde sonsuz döngüye girmemek için; log almak uğruna sürecin
 * kilitlenmesi kabul edilebilir bir maliyet değil.
 */
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

  // Production'da satır başına tek JSON: log toplama araçları bu biçimi
  // ayrıştırabiliyor. Development'ta ise terminalde okunabilirlik önemli.
  const line = env.isProduction
    ? JSON.stringify(entry)
    : `${entry.time} [${level.toUpperCase()}] ${message}` +
      (Object.keys(context).length ? ` ${JSON.stringify(redact(context))}` : '');

  // Seviyeye göre doğru akışa yazmak, stderr'i ayrı toplayan ortamlarda önemli.
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

module.exports = {
  // requestLogger de aynı maskeleme kurallarını kullansın diye dışa açık.
  redact,
  // debug yalnızca development'ta yazıyor: production log'unu ayrıntıyla
  // doldurmanın maliyeti var ve gürültü gerçek hataları gizliyor.
  debug: (message, context) => { if (!env.isProduction) write('debug', message, context); },
  info: (message, context) => write('info', message, context),
  warn: (message, context) => write('warn', message, context),
  error: (message, context) => write('error', message, context),
};
