/**
 * Yapılandırılmış logger. console.log yerine bu katman var çünkü hassas
 * alanların maskelenmesi ve çıktının ortama göre biçim değiştirmesi gerekiyor.
 * Arayüz winston/pino'ya benzer tutuldu; değiştirmek çağrı noktalarını etkilemez.
 */
const env = require('../config/env');

// Anahtarlar küçük harfe çevrilerek karşılaştırılıyor: "idToken" ve "idtoken" aynı.
const SENSITIVE_KEYS = new Set([
  'password', 'newpassword', 'currentpassword',
  'token', 'idtoken', 'accesstoken', 'refreshtoken', 'csrftoken',
  'authorization', 'cookie', 'secret', 'privatekey', 'apikey',
]);

/**
 * Nesneyi kopyalayarak hassas alanları maskeler. Özyinelemeli, çünkü hassas
 * veri çoğu zaman iç içe geliyor (ör. { body: { password } }). depth sınırı
 * kendine referans veren nesnelerde sonsuz döngüyü engelliyor.
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

  // Production'da satır başına tek JSON (log toplama araçları için),
  // development'ta okunabilir metin.
  const line = env.isProduction
    ? JSON.stringify(entry)
    : `${entry.time} [${level.toUpperCase()}] ${message}` +
      (Object.keys(context).length ? ` ${JSON.stringify(redact(context))}` : '');

  // stderr'i ayrı toplayan ortamlarda seviyeye göre doğru akış önemli.
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

// Testlerde bilgi seviyesindeki akış logları Jest çıktısını boğuyor. warn ve
// error açık kalıyor: gerçek bir sorun sessizce kaybolmasın.
const isTest = env.nodeEnv === 'test';

module.exports = {
  // requestLogger de aynı maskeleme kurallarını kullansın diye dışa açık.
  redact,
  // debug yalnızca development'ta yazar; production logunda gürültü yapmasın.
  debug: (message, context) => { if (!env.isProduction && !isTest) write('debug', message, context); },
  info: (message, context) => { if (!isTest) write('info', message, context); },
  warn: (message, context) => write('warn', message, context),
  error: (message, context) => write('error', message, context),
};
