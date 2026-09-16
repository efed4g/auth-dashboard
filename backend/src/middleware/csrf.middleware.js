const crypto = require('crypto');
const tokenUtil = require('../utils/token');
const ApiError = require('../utils/apiError');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit cookie ile CSRF koruması: csrfToken cookie'si httpOnly değildir,
 * frontend değerini okuyup X-CSRF-Token başlığına koyar. Saldırgan site
 * same-origin policy nedeniyle cookie'yi okuyamaz, başlığı üretemez.
 *
 * sameSite tek başına yetmez; cross-site deploy'da sameSite=none gerekir.
 */
function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?.[tokenUtil.CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) {
    return next(ApiError.forbidden('CSRF token eksik.', { code: 'CSRF_MISSING' }));
  }

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  const matches = cookieBuffer.length === headerBuffer.length &&
    crypto.timingSafeEqual(cookieBuffer, headerBuffer);

  if (!matches) {
    return next(ApiError.forbidden('CSRF token geçersiz.', { code: 'CSRF_INVALID' }));
  }

  return next();
}

module.exports = { verifyCsrf, CSRF_HEADER };
