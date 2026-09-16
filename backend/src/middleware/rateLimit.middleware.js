const rateLimit = require('express-rate-limit');

function buildLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // Amaç brute-force'u yavaşlatmak; başarılı istekler sayaca yazılmaz.
    skipSuccessfulRequests: true,
    handler: (req, res) => res.status(429).json({ error: message }),
  });
}

const loginLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Çok fazla giriş denemesi yaptınız. Lütfen 15 dakika sonra tekrar deneyin.',
});

const registerLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Çok fazla kayıt isteği gönderdiniz. 1 saat sonra tekrar deneyin.',
});

const passwordResetLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Çok fazla şifre sıfırlama isteği. 15 dakika sonra tekrar deneyin.',
});

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
