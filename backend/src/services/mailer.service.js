/**
 * E-posta gönderimi.
 *
 * Gerçek bir sağlayıcı entegre edilmedi; bağlantılar geliştirme terminaline
 * yazdırılıyor. Çağıran taraf bunu bilmiyor: sağlayıcıya geçmek yalnızca
 * deliver() fonksiyonunu değiştirmeyi gerektiriyor.
 */
const env = require('../config/env');
const logger = require('../utils/logger');

function deliver(subject, to, link) {
  if (env.isProduction) {
    // Bağlantı loglanmıyor: içinde tek kullanımlık token var, loga düşen bir
    // sıfırlama bağlantısı logu okuyan herkese hesabı açar.
    logger.warn('E-posta sağlayıcısı yapılandırılmamış, mesaj gönderilemedi.', { subject, to });
    return;
  }
  // Bilerek logger yerine console.log ve çerçeveli: akan istek logları
  // arasında gözden kaçmasın.
  console.log(
    `\n--- ${subject} ---\n` +
    `Alıcı : ${to}\n` +
    `Link  : ${link}\n` +
    '------------------------------------\n'
  );
}

// Doğrulama bağlantısı backend'e gidiyor: uç kaydı doğrulayıp kullanıcıyı
// frontend'e yönlendiriyor, böylece frontend'in token'ı görmesi gerekmiyor.
function sendVerificationEmail(email, rawToken) {
  const link = `${env.backendUrl}/api/auth/verify-email?token=${rawToken}`;
  deliver('E-POSTA DOĞRULAMA', email, link);
}

// Sıfırlama bağlantısı frontend'e gidiyor: kullanıcıdan yeni şifre alacak bir
// form gösterilmesi gerekiyor.
function sendPasswordResetEmail(email, rawToken) {
  const link = `${env.frontendUrl}/reset-password?token=${rawToken}`;
  deliver('ŞİFRE SIFIRLAMA', email, link);
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
