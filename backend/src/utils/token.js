/**
 * Token üretimi, doğrulaması ve cookie yazımı.
 *
 * Oturumla ilgili bütün "düşük seviye" işler burada toplandı. Amaç, cookie
 * bayraklarının ve imzalama ayarlarının tek bir yerde durması: sameSite değerini
 * değiştirmek gerektiğinde controller'ları tek tek dolaşmak yerine bu dosyada
 * tek satır değişiyor. Karar mantığı (ne zaman oturum açılır, ne zaman iptal
 * edilir) burada değil, session.service.js'te.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const ACCESS_COOKIE = 'accessToken';
const REFRESH_COOKIE = 'refreshToken';
const CSRF_COOKIE = 'csrfToken';

/**
 * "15m", "7d" gibi JWT süre ifadelerini milisaniyeye çevirir.
 *
 * jsonwebtoken bu formatı anlıyor ama cookie'nin maxAge alanı milisaniye
 * istiyor. İki yerde ayrı ayrı süre tanımlamak yerine tek değeri çevirerek
 * token ömrü ile cookie ömrünün birbirinden kaymasını engelliyoruz.
 *
 * @param   {string} ttl  Örn. "15m", "7d"
 * @returns {number}      Milisaniye cinsinden süre
 */
function ttlToMs(ttl) {
  const match = /^(\d+)([smhd])$/.exec(String(ttl).trim());
  if (!match) {
    // Hatalı yazılmış bir TTL sessizce NaN'e dönüşüp cookie'yi oturumluk
    // yapardı; sorunu açılışta görmek için hata fırlatıyoruz.
    throw new Error(`Geçersiz TTL formatı: ${ttl}`);
  }
  const value = Number(match[1]);
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return value * unit;
}

const ACCESS_TTL_MS = ttlToMs(env.jwt.accessTtl);
const REFRESH_TTL_MS = ttlToMs(env.jwt.refreshTtl);

/**
 * Token'ların veritabanında saklanan özetini üretir.
 *
 * Burada bilerek bcrypt kullanılmadı: bcrypt'in yavaşlığı, tahmin edilebilir
 * kullanıcı şifrelerini kaba kuvvete karşı korumak içindir. Bu değerler zaten
 * 256 bit rastgele olduğundan sözlük saldırısı anlamsız, SHA-256 yeterli ve
 * her refresh isteğinde çalışacağı için hızlı olması da avantaj.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * E-posta doğrulama ve şifre sıfırlama için tek kullanımlık token üretir.
 *
 * JWT değil, anlamsız rastgele bir dize: içinde taşınacak bir bilgi yok ve
 * tek kullanımlık olması gerektiği için zaten veritabanı kaydına bağlı.
 * Ham hali kullanıcıya (bağlantıda), yalnızca özeti veritabanına gider;
 * böylece veritabanı okunsa bile kimsenin şifresi sıfırlanamaz.
 *
 * @returns {{token: string, hash: string}} Ham token ve saklanacak özeti
 */
function generateOpaqueToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}

/**
 * Access token üretir. Kısa ömürlüdür ve korumalı uçlarda kimlik kanıtıdır.
 *
 * Payload'a rol de konuyor ki her istekte kullanıcıyı veritabanından çekmek
 * gerekmesin. `type` claim'i ise access ile refresh'i birbirinden ayırıyor:
 * anahtarlar da farklı olduğu için biri diğerinin yerine sunulamıyor.
 */
function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, role: user.role, type: 'access' },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessTtl }
  );
}

/**
 * Refresh token üretir ve yanında veritabanına yazılacak bilgileri döndürür.
 *
 * jti (benzersiz kimlik) olmadan aynı kullanıcı için aynı saniyede üretilen
 * iki token birebir aynı dizeye dönüşürdü; rotasyon zincirini takip
 * edebilmek için her token'ın farklı olması şart.
 *
 * @returns {{token: string, hash: string, expiresAt: Date}}
 */
function signRefreshToken(user) {
  const token = jwt.sign(
    { sub: String(user.id), type: 'refresh', jti: crypto.randomUUID() },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshTtl }
  );
  return {
    token,
    hash: hashToken(token),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  };
}

// jwt.verify imzayı ve süreyi kontrol eder ama tipi kontrol etmez. `type`
// karşılaştırması olmasaydı, anahtarların ayrı olmadığı bir yapılandırmada
// refresh token access yerine kullanılabilirdi; ikinci bir güvenlik ağı.
function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.jwt.accessSecret);
  if (payload.type !== 'access') {
    throw new jwt.JsonWebTokenError('Beklenmeyen token tipi.');
  }
  return payload;
}

function verifyRefreshToken(token) {
  const payload = jwt.verify(token, env.jwt.refreshSecret);
  if (payload.type !== 'refresh') {
    throw new jwt.JsonWebTokenError('Beklenmeyen token tipi.');
  }
  return payload;
}

/**
 * Bütün oturum cookie'lerinin ortak ayarları.
 *
 * secure ve sameSite değerleri ortamdan geliyor (bkz. config/env.js); burada
 * sabit yazılsalardı development'ta cookie hiç yazılmaz ya da production'da
 * korumasız kalırdı. path: '/' ise cookie'nin tüm uçlarda geçerli olması için.
 */
function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    domain: env.cookie.domain,
    path: '/',
  };
}

// Access ve refresh ayrı cookie'lerde: refresh yalnızca yenileme ucunda
// kullanılıyor ve ömürleri farklı, tek cookie'de taşımanın bir faydası yok.
function setAuthCookies(res, { accessToken, refreshToken }) {
  const options = baseCookieOptions();
  res.cookie(ACCESS_COOKIE, accessToken, { ...options, maxAge: ACCESS_TTL_MS });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...options, maxAge: REFRESH_TTL_MS });
}

// Tek httpOnly olmayan cookie bu. Double-submit deseninin çalışması için
// frontend'in değeri okuyup X-CSRF-Token başlığına koyabilmesi gerekiyor.
// İçinde gizli bir bilgi taşımadığı için JS'e açık olması sorun değil.
function setCsrfCookie(res, csrfToken) {
  res.cookie(CSRF_COOKIE, csrfToken, {
    ...baseCookieOptions(),
    httpOnly: false,
    maxAge: REFRESH_TTL_MS,
  });
}

function clearAuthCookies(res) {
  // Tarayıcı silme isteğini yalnızca name + path + domain üçlüsü birebir
  // eşleşirse uyguluyor. Bu yüzden silerken de yazarkenki seçenekler veriliyor;
  // aksi halde cookie sunucuda silinmiş sanılıp tarayıcıda kalmaya devam eder.
  const options = baseCookieOptions();
  res.clearCookie(ACCESS_COOKIE, options);
  res.clearCookie(REFRESH_COOKIE, options);
  res.clearCookie(CSRF_COOKIE, { ...options, httpOnly: false });
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
  ACCESS_TTL_MS,
  REFRESH_TTL_MS,
  hashToken,
  generateOpaqueToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  setAuthCookies,
  setCsrfCookie,
  clearAuthCookies,
};
