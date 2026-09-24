/**
 * Token üretimi, doğrulaması ve cookie yazımı.
 *
 * Cookie bayrakları ve imzalama ayarları tek yerde duruyor; sameSite gibi bir
 * değeri değiştirmek controller'ları dolaşmayı gerektirmiyor. Karar mantığı
 * (ne zaman oturum açılır/iptal edilir) burada değil, session.service.js'te.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const ACCESS_COOKIE = 'accessToken';
const REFRESH_COOKIE = 'refreshToken';
const CSRF_COOKIE = 'csrfToken';

/**
 * "15m", "7d" gibi JWT sürelerini milisaniyeye çevirir.
 * Cookie'nin maxAge'i milisaniye istiyor; tek değerden türetmek token ömrü ile
 * cookie ömrünün birbirinden kaymasını engelliyor.
 */
function ttlToMs(ttl) {
  const match = /^(\d+)([smhd])$/.exec(String(ttl).trim());
  if (!match) {
    // Hatalı TTL sessizce NaN'e dönüşüp cookie'yi oturumluk yapardı.
    throw new Error(`Geçersiz TTL formatı: ${ttl}`);
  }
  const value = Number(match[1]);
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return value * unit;
}

const ACCESS_TTL_MS = ttlToMs(env.jwt.accessTtl);
const REFRESH_TTL_MS = ttlToMs(env.jwt.refreshTtl);

// bcrypt yerine SHA-256: bcrypt'in yavaşlığı tahmin edilebilir şifreler için.
// Bu değerler 256 bit rastgele, sözlük saldırısı anlamsız.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * E-posta doğrulama ve şifre sıfırlama için tek kullanımlık token.
 * Ham hali kullanıcıya, yalnızca özeti veritabanına gider.
 */
function generateOpaqueToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}

// Rol payload'a konuyor ki her istekte veritabanına gidilmesin.
// `type` claim'i access ile refresh'i ayırıyor (anahtarlar da farklı).
function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, role: user.role, type: 'access' },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessTtl }
  );
}

// jti olmadan aynı saniyede üretilen iki token birebir aynı dizeye dönüşürdü;
// rotasyon zincirini takip edebilmek için her biri farklı olmalı.
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

// jwt.verify imzayı ve süreyi kontrol eder ama tipi etmez; `type` karşılaştırması
// ikinci güvenlik ağı.
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

// secure ve sameSite ortamdan geliyor: sabit yazılsalardı development'ta cookie
// hiç yazılmaz ya da production'da korumasız kalırdı.
function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    domain: env.cookie.domain,
    path: '/',
  };
}

function setAuthCookies(res, { accessToken, refreshToken }) {
  const options = baseCookieOptions();
  res.cookie(ACCESS_COOKIE, accessToken, { ...options, maxAge: ACCESS_TTL_MS });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...options, maxAge: REFRESH_TTL_MS });
}

// Tek httpOnly olmayan cookie. Double-submit deseni için frontend'in değeri
// okuyup X-CSRF-Token başlığına koyabilmesi gerekiyor.
function setCsrfCookie(res, csrfToken) {
  res.cookie(CSRF_COOKIE, csrfToken, {
    ...baseCookieOptions(),
    httpOnly: false,
    maxAge: REFRESH_TTL_MS,
  });
}

function clearAuthCookies(res) {
  // Tarayıcı silmeyi yalnızca name + path + domain eşleşirse uyguluyor.
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
