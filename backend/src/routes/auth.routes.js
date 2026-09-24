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
 * /api/auth altındaki uçlar. Burada yalnızca "hangi yol, hangi middleware'den
 * geçip hangi controller'a gider" bilgisi var; iş mantığı controller'da.
 */
const router = express.Router();

// Frontend, durum değiştiren ilk isteğinden önce çağırır.
router.get('/csrf', asyncHandler(controller.getCsrfToken));

// verify-email GET: kullanıcı bu adrese e-postadaki bağlantıdan geliyor.
router.post('/register', registerLimiter, asyncHandler(controller.register));
router.get('/verify-email', asyncHandler(controller.verifyEmail));

router.post('/login', loginLimiter, asyncHandler(controller.login));
router.post('/google', oauthLimiter, asyncHandler(controller.loginWithGoogle));

// Üçünde de requireAuth yok: hepsi access token'ın süresi dolmuşken de
// çalışabilmeli, kimlik kanıtı olarak refresh cookie'si kullanılıyor.
router.post('/refresh', asyncHandler(controller.refresh));
router.post('/logout', asyncHandler(controller.logout));
router.post('/logout-all', asyncHandler(controller.logoutAll));

router.post('/forgot-password', passwordResetLimiter, asyncHandler(controller.forgotPassword));
router.post('/reset-password', passwordResetLimiter, asyncHandler(controller.resetPassword));

// Rate limit burada da var: mevcut şifreyi deneme yanılmayla bulmaya çalışmak
// da bir saldırı yüzeyi.
router.post(
  '/set-password',
  requireAuth,
  passwordResetLimiter,
  asyncHandler(controller.setPassword)
);

// requireActive bilerek yok: aktifleştirmeyi zaten pasif kullanıcı çağıracak,
// pasif bir hesap da silinebilmeli.
router.post('/deactivate', requireAuth, asyncHandler(controller.deactivateAccount));
router.post('/reactivate', requireAuth, asyncHandler(controller.reactivateAccount));
router.post('/delete-account', requireAuth, asyncHandler(controller.deleteAccount));

// Frontend açılışta çağırıp oturumun geçerli olup olmadığını öğreniyor.
router.get('/me', requireAuth, asyncHandler(controller.me));

module.exports = router;
