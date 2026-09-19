/**
 * E-posta gönderimi.
 *
 * Gerçek bir sağlayıcı (SendGrid, Mailgun vb.) entegre edilmedi; bağlantılar
 * geliştirme terminaline yazdırılıyor. Bunu bilinçli bir sınır olarak
 * bıraktım: ödevin konusu kimlik doğrulama akışı, e-posta altyapısı değil.
 *
 * Buna karşılık çağıran taraf bunu bilmiyor — controller sadece
 * sendVerificationEmail çağırıyor. Gerçek bir sağlayıcıya geçmek yalnızca
 * deliver() fonksiyonunu değiştirmeyi gerektiriyor, akışın geri kalanı aynı kalır.
 */
const env = require('../config/env');
const logger = require('../utils/logger');

function deliver(subject, to, link) {
  if (env.isProduction) {
    // Production'da bağlantı loglanmıyor: içinde tek kullanımlık token var ve
    // log'a düşen bir sıfırlama bağlantısı, log'u okuyan herkese hesabı açar.
    // Gönderim yapılamadığı bilgisi ise kaydediliyor ki sorun fark edilsin.
    logger.warn('E-posta sağlayıcısı yapılandırılmamış, mesaj gönderilemedi.', { subject, to });
    return;
  }
  // Geliştirme çıktısı bilerek logger yerine console.log ile ve çerçeveli:
  // terminalde akan istek logları arasında gözden kaçmasın.
  console.log(
    `\n--- ${subject} ---\n` +
    `Alıcı : ${to}\n` +
    `Link  : ${link}\n` +
    '------------------------------------\n'
  );
}

// Doğrulama bağlantısı backend'e gidiyor: uç, kaydı doğrulayıp kullanıcıyı
// frontend'e yönlendiriyor. Böylece frontend'in token'ı görmesi gerekmiyor.
function sendVerificationEmail(email, rawToken) {
  const link = `${env.backendUrl}/api/auth/verify-email?token=${rawToken}`;
  deliver('E-POSTA DOĞRULAMA', email, link);
}

// Sıfırlama bağlantısı ise frontend'e gidiyor, çünkü kullanıcıdan yeni şifre
// alacak bir form gösterilmesi gerekiyor.
function sendPasswordResetEmail(email, rawToken) {
  const link = `${env.frontendUrl}/reset-password?token=${rawToken}`;
  deliver('ŞİFRE SIFIRLAMA', email, link);
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
