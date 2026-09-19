const crypto = require('crypto');
const tokenUtil = require('../utils/token');
const ApiError = require('../utils/apiError');

// Veri değiştirmeyen metotlar muaf: CSRF'in tehlikesi yan etki yaratan
// isteklerde. GET'i de kapsama almak, her sayfa açılışında token gerektirip
// akışı gereksiz karmaşıklaştırırdı.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit cookie yöntemiyle CSRF koruması.
 *
 * Neden gerekli: oturumu cookie'de taşıdığımız için tarayıcı, isteği hangi
 * sitenin başlattığına bakmadan cookie'yi otomatik gönderiyor. Yani kullanıcı
 * başka bir sitedeyken oraya gömülmüş bir form bizim API'mize giriş yapmış
 * kullanıcı adına istek atabilir.
 *
 * Nasıl çalışıyor: csrfToken cookie'si bilerek httpOnly değil. Frontend değeri
 * okuyup X-CSRF-Token başlığına koyuyor, burada ikisi karşılaştırılıyor.
 * Saldırgan site cookie'yi same-origin policy nedeniyle okuyamadığı için
 * doğru başlığı üretemiyor; cookie otomatik gitse bile istek başlıksız kalıyor.
 *
 * Neden yalnızca sameSite yetmedi: frontend ile backend farklı domainlerde
 * deploy edilirse cookie'nin gidebilmesi için sameSite=none gerekiyor ve o anda
 * sameSite'ın sağladığı koruma tamamen ortadan kalkıyor. Bu katman topolojiden
 * bağımsız çalışıyor, sameSite ise ikinci savunma hattı olarak duruyor.
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

  // Düz === karşılaştırması ilk farklı karakterde duruyor ve geçen süre
  // kaç karakterin tuttuğunu ele veriyor. timingSafeEqual sabit sürede
  // çalışıyor; uzunluk kontrolü ayrıca gerekli çünkü fonksiyon farklı
  // uzunluktaki tamponlarda hata fırlatıyor.
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
