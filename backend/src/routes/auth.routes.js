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

const router = express.Router();

router.get('/csrf', asyncHandler(controller.getCsrfToken));

router.post('/register', registerLimiter, asyncHandler(controller.register));
router.get('/verify-email', asyncHandler(controller.verifyEmail));

router.post('/login', loginLimiter, asyncHandler(controller.login));
router.post('/google', oauthLimiter, asyncHandler(controller.loginWithGoogle));

router.post('/refresh', asyncHandler(controller.refresh));
router.post('/logout', asyncHandler(controller.logout));
// requireAuth yok: access token süresi dolmuşken de çalışabilmeli.
router.post('/logout-all', asyncHandler(controller.logoutAll));

router.post('/forgot-password', passwordResetLimiter, asyncHandler(controller.forgotPassword));
router.post('/reset-password', passwordResetLimiter, asyncHandler(controller.resetPassword));

router.post(
  '/set-password',
  requireAuth,
  passwordResetLimiter,
  asyncHandler(controller.setPassword)
);

router.get('/me', requireAuth, asyncHandler(controller.me));

module.exports = router;
