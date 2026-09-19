const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  oauthLimiter,
} = require('../middleware/rateLimit.middleware');

/**
 * /api/auth altındaki uçlar.
 *
 * Rota dosyası bilerek ince tutuldu: burada yalnızca "hangi yol, hangi
 * middleware'lerden geçerek hangi controller'a gider" bilgisi var. İş mantığı
 * controller'da, oturum yönetimi servis katmanında. Bu sayede bir ucun
 * korumalı olup olmadığı tek satıra bakarak anlaşılıyor.
 */
const router = express.Router();

// CSRF token'ı verir. Frontend, durum değiştiren ilk isteğinden önce çağırır.
router.get('/csrf', asyncHandler(controller.getCsrfToken));

// Kayıt ve e-posta doğrulama.
// verify-email GET çünkü kullanıcı bu adrese e-postadaki bağlantıdan geliyor.
router.post('/register', registerLimiter, asyncHandler(controller.register));
router.get('/verify-email', asyncHandler(controller.verifyEmail));

// Giriş yolları: klasik e-posta/şifre ve Google.
router.post('/login', loginLimiter, asyncHandler(controller.login));
router.post('/google', oauthLimiter, asyncHandler(controller.loginWithGoogle));

// Oturum yenileme ve çıkış. Üçünde de requireAuth yok, çünkü hepsi tam da
// access token'ın süresi dolmuşken çalışabilmeli; kimlik kanıtı olarak
// refresh cookie'si kullanılıyor.
router.post('/refresh', asyncHandler(controller.refresh));
router.post('/logout', asyncHandler(controller.logout));
router.post('/logout-all', asyncHandler(controller.logoutAll));

// Şifre sıfırlama akışı: istek ve yeni şifre belirleme.
router.post('/forgot-password', passwordResetLimiter, asyncHandler(controller.forgotPassword));
router.post('/reset-password', passwordResetLimiter, asyncHandler(controller.resetPassword));

// Şifre belirleme/değiştirme oturum içinde yapılıyor, bu yüzden requireAuth
// var. Rate limit de uygulanıyor: mevcut şifreyi deneme yanılmayla bulmaya
// çalışmak da bir saldırı yüzeyi.
router.post(
  '/set-password',
  requireAuth,
  passwordResetLimiter,
  asyncHandler(controller.setPassword)
);

// Frontend açılışta bunu çağırıp oturumun geçerli olup olmadığını öğreniyor.
router.get('/me', requireAuth, asyncHandler(controller.me));

module.exports = router;
