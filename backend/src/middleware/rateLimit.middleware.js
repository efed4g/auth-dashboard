/**
 * Kimlik doğrulama uçları için istek sınırlayıcılar.
 *
 * Sayaçlar bellekte tutuluyor: tek sunucu varsayımı. Birden fazla instance
 * çalıştırılacaksa Redis destekli bir store gerekir.
 */
const rateLimit = require('express-rate-limit');

/**
 * @param {number} windowMs Sayacın sıfırlandığı süre
 * @param {number} max      Bu süre içindeki azami başarısız istek
 * @param {string} message  Sınır aşıldığında dönecek açıklama
 */
function buildLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // Başarılı istekler sayılmıyor: doğru şifreyle giren kullanıcı, aynı ağdan
    // bağlanan başkası yüzünden kilitlenmesin.
    skipSuccessfulRequests: true,
    // Varsayılan cevap düz metin; frontend her yerde aynı JSON şeklini bekliyor.
    handler: (req, res) => res.status(429).json({ error: message }),
  });
}

// Kaba kuvvetin asıl hedefi olduğu için en dar pencere burada.
const loginLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Çok fazla giriş denemesi yaptınız. Lütfen 15 dakika sonra tekrar deneyin.',
});

// Otomatik araçlarla sahte hesap üretilmesini zorlaştırıyor.
const registerLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Çok fazla kayıt isteği gönderdiniz. 1 saat sonra tekrar deneyin.',
});

// Sınırsız bırakılırsa bir adrese sürekli e-posta göndermek için kullanılabilir.
const passwordResetLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Çok fazla şifre sıfırlama isteği. 15 dakika sonra tekrar deneyin.',
});

// Şifre denemesi içermediği için daha gevşek; yine de her istek bir Firebase
// doğrulama çağrısı maliyeti taşıyor.
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
