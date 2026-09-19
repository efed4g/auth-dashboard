/**
 * Kimlik doğrulama uçları için istek sınırlayıcılar.
 *
 * Şifre kontrolü tek başına kaba kuvvet saldırısını engellemiyor: saldırgan
 * saniyede yüzlerce deneme yapabildiği sürece zayıf bir şifre er geç bulunur.
 * Bu katman denemeleri yavaşlatarak saldırıyı pratikte işe yaramaz hale
 * getiriyor. Sayaçlar bellekte tutuluyor, yani tek sunucu varsayımına dayanıyor;
 * birden fazla instance çalıştırılırsa Redis destekli bir store gerekir.
 */
const rateLimit = require('express-rate-limit');

/**
 * Ortak ayarları tek yerde toplayan yardımcı. Her limiter'ı elle kurmak
 * yerine bunu kullanmak, ayarların birbirinden ayrı düşmesini engelliyor.
 *
 * @param {number} windowMs  Sayacın sıfırlandığı süre
 * @param {number} max       Bu süre içindeki azami başarısız istek
 * @param {string} message   Sınır aşıldığında dönecek açıklama
 */
function buildLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    // Kalan hakkı RateLimit-* başlıklarıyla bildiriyoruz; eski X-RateLimit-*
    // biçimi kapalı, ikisini birden göndermenin faydası yok.
    standardHeaders: true,
    legacyHeaders: false,
    // Başarılı istekler sayaca yazılmıyor. Amaç deneme yanılmayı kısıtlamak;
    // doğru şifreyle giren bir kullanıcının, aynı ağdan bağlanan başkası
    // yüzünden kilitlenmesi gereksiz bir kısıtlama olurdu.
    skipSuccessfulRequests: true,
    // Varsayılan cevap düz metin. Diğer hatalarla aynı JSON biçimini
    // korumak için özel handler yazıldı, frontend tek bir şekil bekliyor.
    handler: (req, res) => res.status(429).json({ error: message }),
  });
}

// Giriş: kaba kuvvetin asıl hedefi olduğu için en dar pencere burada.
const loginLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Çok fazla giriş denemesi yaptınız. Lütfen 15 dakika sonra tekrar deneyin.',
});

// Kayıt: saldırı hedefi değil ama otomatik araçlarla sahte hesap üretilmesini
// zorlaştırıyor. Normal bir kullanıcı saatte birden fazla hesap açmaz.
const registerLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Çok fazla kayıt isteği gönderdiniz. 1 saat sonra tekrar deneyin.',
});

// Şifre sıfırlama: sınırsız bırakılırsa bir kullanıcının adresine sürekli
// e-posta gönderilmesi için kötüye kullanılabilir.
const passwordResetLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Çok fazla şifre sıfırlama isteği. 15 dakika sonra tekrar deneyin.',
});

// Google girişi: şifre denemesi içermediği için sınır daha gevşek. Yine de
// açık bırakılmadı, her uç bir maliyet (Firebase doğrulama çağrısı) taşıyor.
const oauthLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.',
});

module.exports = {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  oauthLimiter,
};
