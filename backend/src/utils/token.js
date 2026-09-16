const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const ACCESS_COOKIE = 'accessToken';
const REFRESH_COOKIE = 'refreshToken';
const CSRF_COOKIE = 'csrfToken';

// "15m", "7d" gibi süreleri cookie maxAge için milisaniyeye çevirir.
function ttlToMs(ttl) {
  const match = /^(\d+)([smhd])$/.exec(String(ttl).trim());
  if (!match) {
    throw new Error(`Geçersiz TTL formatı: ${ttl}`);
  }
  const value = Number(match[1]);
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return value * unit;
}

const ACCESS_TTL_MS = ttlToMs(env.jwt.accessTtl);
const REFRESH_TTL_MS = ttlToMs(env.jwt.refreshTtl);

// Rastgele ve yüksek entropili değerler olduğu için bcrypt yerine SHA-256 yeterli.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// E-posta doğrulama / şifre sıfırlama için tek kullanımlık token.
function generateOpaqueToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}

// Ayrı secret + `type` claim'i: biri diğerinin yerine kullanılamaz.
function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, role: user.role, type: 'access' },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessTtl }
  );
}

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

// Bayraklar ortamdan türetilir; hiçbir yerde sabit yazılmaz.
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

// CSRF cookie'si httpOnly değil: frontend değeri okuyup X-CSRF-Token'a koyar.
function setCsrfCookie(res, csrfToken) {
  res.cookie(CSRF_COOKIE, csrfToken, {
    ...baseCookieOptions(),
    httpOnly: false,
    maxAge: REFRESH_TTL_MS,
  });
}

function clearAuthCookies(res) {
  // Silme isteğinin eşleşmesi için set ederkenki bayraklar birebir verilir.
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
