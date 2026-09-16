const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, User, RefreshToken } = require('../models');
const tokenUtil = require('../utils/token');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

// Rotasyondan hemen sonra yolda olan paralel istekler için tolerans penceresi.
const REUSE_GRACE_MS = 20 * 1000;

// İptal işlemi transaction dışında yapılmalı, aksi halde rollback onu da geri alır.
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

// Yeni oturum: cookie'leri set eder, refresh token'ın özetini kaydeder.
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
 * Refresh token rotasyonu.
 * Satır FOR UPDATE ile kilitlenir; eşzamanlı iki yenileme birbirini
 * "token çalındı" sanıp oturumları düşürmez.
 */
async function rotateSession(res, presentedToken) {
  if (!presentedToken) {
    throw ApiError.unauthorized('Oturum bulunamadı.');
  }

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
      const stored = await RefreshToken.findOne({
        where: { tokenHash: presentedHash },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      // İmza geçerli ama kayıt yok: temizlenmiş veya sahte.
      if (!stored) {
        throw new SessionCompromisedError(userId, 'unknown_token');
      }

      if (stored.expiresAt.getTime() <= Date.now()) {
        await stored.update({ revokedAt: stored.revokedAt || new Date() }, { transaction });
        return { expired: true };
      }

      if (stored.revokedAt) {
        const sinceRevoke = Date.now() - stored.revokedAt.getTime();
        const inGraceWindow = Boolean(stored.replacedByHash) && sinceRevoke <= REUSE_GRACE_MS;

        // Grace yalnızca zincirin devamı hâlâ yaşıyorsa geçerli. Aksi halde
        // oturum logout-all veya reuse tespiti ile sonlandırılmış demektir ve
        // pencere içinde olsa bile diriltilmemeli.
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

      // Rol değişmiş olabileceği için token'dan değil DB'den okunur.
      const user = await User.findByPk(userId, { transaction });
      if (!user) {
        throw new SessionCompromisedError(userId, 'user_missing');
      }

      const accessToken = tokenUtil.signAccessToken(user);
      const refresh = tokenUtil.signRefreshToken(user);

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

  // Cookie'ler ancak commit başarılı olduktan sonra set edilir.
  tokenUtil.setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
  issueCsrfToken(res);

  return result.user;
}

// Tek cihazdan çıkış.
async function revokeSession(presentedToken) {
  if (!presentedToken) return;
  await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { tokenHash: tokenUtil.hashToken(presentedToken), revokedAt: null } }
  );
}

// Tüm cihazlardan çıkış / revocation.
async function revokeAllForUser(userId, { transaction } = {}) {
  await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { userId, revokedAt: null }, transaction }
  );
}

// Süresi dolmuş ve bir gündür iptalli kayıtları siler.
async function purgeExpiredTokens() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const removed = await RefreshToken.destroy({
    where: {
      [Op.or]: [
        { expiresAt: { [Op.lt]: new Date() } },
        { revokedAt: { [Op.lt]: cutoff } },
      ],
    },
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
