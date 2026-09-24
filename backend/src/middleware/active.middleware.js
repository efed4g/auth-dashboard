/**
 * Devre dışı hesapların korumalı uçlara erişimini engeller; requireAuth'tan
 * SONRA kullanılmalı. Bayrak token'a gömülmüyor, her istekte veritabanından
 * okunuyor: gömülseydi hesap pasifleştirildiğinde token yenilenene kadar
 * değişiklik geçerli olmazdı.
 *
 * Kasıtlı olarak uygulanmadığı uçlar: /auth/me, /auth/reactivate, /auth/logout.
 */
const { User } = require('../models');
const ApiError = require('../utils/apiError');

async function requireActive(req, res, next) {
  try {
    if (!req.user) {
      return next(ApiError.unauthorized('Giriş yapmalısınız.'));
    }

    const user = await User.findByPk(req.user.id, { attributes: ['id', 'isActive'] });

    if (!user) {
      return next(ApiError.unauthorized('Kullanıcı bulunamadı.'));
    }

    if (!user.isActive) {
      // Arayüz bu koda bakıp aktifleştirme ekranını gösteriyor.
      return next(ApiError.forbidden(
        'Hesabınız devre dışı. Devam etmek için hesabınızı yeniden etkinleştirin.',
        { code: 'ACCOUNT_INACTIVE' }
      ));
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireActive };
