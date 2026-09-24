const crypto = require('crypto');
const tokenUtil = require('../utils/token');
const ApiError = require('../utils/apiError');

// Veri değiştirmeyen metotlar muaf: CSRF'in tehlikesi yan etki yaratan isteklerde.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit cookie yöntemiyle CSRF koruması.
 *
 * Oturum cookie'de taşındığı için tarayıcı, isteği hangi site başlatırsa
 * başlatsın cookie'yi gönderiyor. csrfToken cookie'si bu yüzden httpOnly
 * değil: frontend değeri okuyup X-CSRF-Token başlığına koyuyor, burada ikisi
 * karşılaştırılıyor. Saldırgan site cookie'yi okuyamadığı için başlığı üretemiyor.
 *
 * sameSite tek başına yetmiyor: frontend ve backend farklı domainlerde
 * deploy edilirse sameSite=none gerekiyor ve koruma ortadan kalkıyor.
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

  // === ilk farklı karakterde durur ve geçen süre kaç karakterin tuttuğunu ele
  // verir. Uzunluk kontrolü şart: timingSafeEqual farklı uzunlukta hata fırlatıyor.
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
