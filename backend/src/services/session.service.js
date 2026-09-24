/**
 * Oturum yaşam döngüsü: açma, yenileme, iptal.
 *
 * Token üretimi, veritabanı kaydı ve cookie yazımı birlikte ve doğru sırayla
 * yapılmak zorunda; dağıtılsaydı bir yerde cookie yazılıp kayıt atlanabilir,
 * oturum ilk yenilemede "çalınmış" sanılabilirdi.
 */
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, User, RefreshToken } = require('../models');
const tokenUtil = require('../utils/token');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

// Rotasyon sonrası tolerans penceresi. React StrictMode'un çift çağrısı, iki
// açık sekme veya yeniden denenen bir istek aynı token'ı neredeyse aynı anda
// sunabiliyor; ikincisini "çalındı" saymak kullanıcıyı boş yere atıyordu.
const REUSE_GRACE_MS = 20 * 1000;

// Şüpheli kullanımı transaction dışına taşımak için. İptali transaction içinde
// yapıp hata fırlatınca rollback iptali de geri alıyordu.
class SessionCompromisedError extends Error {
  constructor(userId, reason) {
    super(reason);
    this.name = 'SessionCompromisedError';
    this.userId = userId;
    this.reason = reason;
  }
}

function issueCsrfToken(res) {
  const csrfToken = crypto.randomBytes(32).toString('hex');
  tokenUtil.setCsrfCookie(res, csrfToken);
  return csrfToken;
}

/**
 * Oturum açar: token çiftini üretir, refresh'in özetini kaydeder, cookie yazar.
 * Giriş, Google girişi ve şifre değişikliği aynı fonksiyondan geçiyor.
 */
async function createSession(res, user, { transaction } = {}) {
  const accessToken = tokenUtil.signAccessToken(user);
  const refresh = tokenUtil.signRefreshToken(user);

  await RefreshToken.create({
    userId: user.id,
    tokenHash: refresh.hash,
    expiresAt: refresh.expiresAt,
  }, { transaction });

  tokenUtil.setAuthCookies(res, {
    accessToken,
    refreshToken: refresh.token,
  });
  issueCsrfToken(res);

  return user;
}

/**
 * Refresh token rotasyonu: sunulan token iptal edilip yerine yenisi verilir.
 *
 * Sabit bir token bir kez çalındığında saldırgan haftalarca oturum açabilirdi.
 * Rotasyonla çalınan kopya ilk meşru yenilemeden sonra geçersiz kalıyor; iptal
 * edilmiş bir token'ın tekrar sunulması da sızıntının kanıtı oluyor.
 *
 * @throws {ApiError} 401 geçersiz/süresi dolmuş, 403 şüpheli kullanım
 */
async function rotateSession(res, presentedToken) {
  if (!presentedToken) {
    throw ApiError.unauthorized('Oturum bulunamadı.');
  }

  // İmza kontrolü veritabanına gitmeden: uydurma token için sorgu çalıştırmayalım.
  let payload;
  try {
    payload = tokenUtil.verifyRefreshToken(presentedToken);
  } catch {
    throw ApiError.unauthorized('Geçersiz veya süresi dolmuş oturum.');
  }

  const presentedHash = tokenUtil.hashToken(presentedToken);
  const userId = Number(payload.sub);

  let result;
  try {
    result = await sequelize.transaction(async (transaction) => {
      // FOR UPDATE: kilit olmasaydı iki paralel istek aynı kaydı "iptal
      // edilmemiş" görüp ikisi de rotasyon yapar, zincir çatallanırdı.
      const stored = await RefreshToken.findOne({
        where: { tokenHash: presentedHash },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      // İmza geçerli ama kayıt yok: bir zamanlar bizim ürettiğimiz ama silinmiş
      // bir token. Güvenli tarafta kalıp sızıntı varsayıyoruz.
      if (!stored) {
        throw new SessionCompromisedError(userId, 'unknown_token');
      }

      // Süresi dolmuş token saldırı göstergesi değil, sadece eski.
      if (stored.expiresAt.getTime() <= Date.now()) {
        await stored.update({ revokedAt: stored.revokedAt || new Date() }, { transaction });
        return { expired: true };
      }

      if (stored.revokedAt) {
        const sinceRevoke = Date.now() - stored.revokedAt.getTime();
        const inGraceWindow = Boolean(stored.replacedByHash) && sinceRevoke <= REUSE_GRACE_MS;

        // Tolerans yalnızca zincirin devamı yaşıyorsa geçerli. Sadece "yakında
        // rotate edildi mi" demek yetmiyordu: logout-all ile kapatılmış oturum
        // da pencere içinde diriltilebiliyordu.
        const successor = inGraceWindow
          ? await RefreshToken.findOne({
            where: { tokenHash: stored.replacedByHash },
            transaction,
          })
          : null;

        if (!inGraceWindow || !successor || successor.revokedAt) {
          throw new SessionCompromisedError(userId, 'token_reuse');
        }
        logger.debug('Paralel yenileme isteği tolere edildi.', { userId, sinceRevoke });
      }

      // Rol token'dan değil veritabanından: yetki token üretildikten sonra
      // değişmiş olabilir.
      const user = await User.findByPk(userId, { transaction });
      if (!user) {
        throw new SessionCompromisedError(userId, 'user_missing');
      }

      const accessToken = tokenUtil.signAccessToken(user);
      const refresh = tokenUtil.signRefreshToken(user);

      // revokedAt doluysa üzerine yazılmıyor: ilk iptal zamanı korunmalı.
      await stored.update(
        { revokedAt: stored.revokedAt || new Date(), replacedByHash: refresh.hash },
        { transaction }
      );
      await RefreshToken.create({
        userId: user.id,
        tokenHash: refresh.hash,
        expiresAt: refresh.expiresAt,
      }, { transaction });

      return { user, accessToken, refreshToken: refresh.token };
    });
  } catch (err) {
    // İptal transaction kapandıktan sonra, kendi işleminde çalışıyor.
    if (err instanceof SessionCompromisedError) {
      await revokeAllForUser(err.userId);
      logger.warn('Şüpheli refresh token kullanımı, tüm oturumlar kapatıldı.', {
        userId: err.userId,
        reason: err.reason,
      });
      throw ApiError.forbidden('Oturum güvenliği nedeniyle tüm cihazlardan çıkış yapıldı.');
    }
    throw err;
  }

  if (result.expired) {
    throw ApiError.unauthorized('Oturum süresi doldu, lütfen tekrar giriş yapın.');
  }

  // Cookie yazımı commit sonrasında: içeride yazılıp commit başarısız olsaydı
  // istemcide veritabanı karşılığı olmayan bir token kalırdı.
  tokenUtil.setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
  issueCsrfToken(res);

  return result.user;
}

/**
 * Tek cihazın oturumunu kapatır.
 * Kayıt silinmiyor, iptal işaretleniyor: aynı token sonradan sunulursa bunun
 * sızıntı olduğunu anlayabilmek için geçmiş gerekiyor.
 */
async function revokeSession(presentedToken) {
  if (!presentedToken) return;
  await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { tokenHash: tokenUtil.hashToken(presentedToken), revokedAt: null } }
  );
}

/**
 * Kullanıcının bütün aktif oturumlarını iptal eder.
 * "Tüm cihazlardan çık", şifre değişikliği ve şüpheli kullanım tespitinde.
 */
async function revokeAllForUser(userId, { transaction } = {}) {
  await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { userId, revokedAt: null }, transaction }
  );
}

/**
 * Yalnızca süresi dolmuş kayıtlar siliniyor.
 * İptalliler ömürleri dolana kadar duruyor: reuse detection "bu token vardı ve
 * iptal edildi" bilgisine dayanıyor.
 */
async function purgeExpiredTokens() {
  const removed = await RefreshToken.destroy({
    where: { expiresAt: { [Op.lt]: new Date() } },
  });
  if (removed > 0) {
    logger.info('Süresi dolmuş refresh token kayıtları temizlendi.', { removed });
  }
  return removed;
}

module.exports = {
  REUSE_GRACE_MS,
  issueCsrfToken,
  createSession,
  rotateSession,
  revokeSession,
  revokeAllForUser,
  purgeExpiredTokens,
};
