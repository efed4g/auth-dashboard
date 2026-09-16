const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * E-posta gönderimi simüle edilir: link terminale yazılır.
 * Gerçek bir sağlayıcıya geçmek için yalnızca bu dosya değiştirilir.
 */
function deliver(subject, to, link) {
  if (env.isProduction) {
    // Token'lı link production loglarına düşmemeli.
    logger.warn('E-posta sağlayıcısı yapılandırılmamış, mesaj gönderilemedi.', { subject, to });
    return;
  }
  console.log(
    `\n--- ${subject} ---\n` +
    `Alıcı : ${to}\n` +
    `Link  : ${link}\n` +
    '------------------------------------\n'
  );
}

function sendVerificationEmail(email, rawToken) {
  const link = `${env.backendUrl}/api/auth/verify-email?token=${rawToken}`;
  deliver('E-POSTA DOĞRULAMA', email, link);
}

function sendPasswordResetEmail(email, rawToken) {
  const link = `${env.frontendUrl}/reset-password?token=${rawToken}`;
  deliver('ŞİFRE SIFIRLAMA', email, link);
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
