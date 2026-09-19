/**
 * Oturum yaşam döngüsü.
 *
 * Oturumun açılması, yenilenmesi ve iptali tek bir yerde toplandı. Controller'lar
 * "kullanıcı doğrulandı, oturum aç" deyip geçiyor; token üretimi, veritabanı
 * kaydı ve cookie yazımının birlikte ve doğru sırayla yapılması bu dosyanın
 * sorumluluğu. Dağıtılsaydı, örneğin bir yerde cookie yazılıp veritabanı kaydı
 * atlanabilir ve oturum ilk yenilemede "çalınmış" sanılabilirdi.
 */
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, User, RefreshToken } = require('../models');
const tokenUtil = require('../utils/token');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

/**
 * Rotasyon sonrası tolerans penceresi.
 *
 * Saf rotasyon uygulamasında gerçek bir sorun çıkıyor: React StrictMode'un çift
 * çağrısı, iki açık sekme ya da yeniden denenen bir istek aynı refresh token'ı
 * neredeyse aynı anda sunabiliyor. İkincisi "token çalındı" sayılınca kullanıcı
 * hiçbir şey yapmadan bütün oturumlarından atılıyordu. 20 saniye, ağ gecikmesi
 * ve tekrar denemeler için yeterli; saldırganın işine yarayacak kadar uzun değil.
 */
const REUSE_GRACE_MS = 20 * 1000;

/**
 * Şüpheli token kullanımını transaction'ın dışına taşımak için kullanılan
 * iç hata tipi.
 *
 * İlk denemede iptal işlemi transaction içinde yapılıyordu; sonra hata
 * fırlatılınca rollback iptali de geri alıyor ve çalınmış token geçerli
 * kalmaya devam ediyordu. Artık durum bu hatayla dışarı taşınıyor, iptal
 * transaction kapandıktan sonra kendi işleminde çalışıyor.
 */
class SessionCompromisedError extends Error {
  constructor(userId, reason) {
    super(reason);
    this.name = 'SessionCompromisedError';
    this.userId = userId;
    this.reason = reason;
  }
}

/**
 * Yeni bir CSRF token üretip cookie'ye yazar.
 * Oturum her kurulduğunda ve yenilendiğinde tazeleniyor.
 */
function issueCsrfToken(res) {
  const csrfToken = crypto.randomBytes(32).toString('hex');
  tokenUtil.setCsrfCookie(res, csrfToken);
  return csrfToken;
}

/**
 * Oturum açar: token çiftini üretir, refresh'in özetini kaydeder, cookie'leri yazar.
 *
 * Giriş, Google girişi ve şifre değişikliği sonrası aynı fonksiyondan geçiyor;
 * oturumun nasıl kurulduğu her yerde birebir aynı olsun diye.
 *
 * @param {object} res           Express response (cookie'ler buraya yazılır)
 * @param {object} user          Oturum açacak kullanıcı
 * @param {object} [options.transaction]  Çağıran bir transaction yönetiyorsa
 * @returns {Promise<object>}    Aynı kullanıcı nesnesi
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
 * Refresh token rotasyonu: sunulan token'ı iptal edip yerine yenisini verir.
 *
 * Neden rotasyon: uzun ömürlü bir token sabit kalsaydı, bir kez çalındığında
 * saldırgan haftalarca oturum açabilirdi. Her yenilemede token değişince
 * çalınan kopya ilk meşru yenilemeden sonra geçersiz kalıyor. Dahası, iptal
 * edilmiş bir token'ın tekrar sunulması sızıntının kanıtı oluyor; bu durumda
 * kullanıcının bütün oturumları kapatılıyor.
 *
 * Eşzamanlılık: bütün okuma ve yazma işlemleri tek bir transaction içinde ve
 * satır FOR UPDATE ile kilitlenerek yapılıyor. Kilit olmasaydı iki paralel
 * istek aynı kaydı "henüz iptal edilmemiş" görüp ikisi de rotasyon yapar,
 * zincir çatallanırdı.
 *
 * @param {object} res            Yeni cookie'lerin yazılacağı response
 * @param {string} presentedToken İstemcinin cookie'de sunduğu refresh token
 * @returns {Promise<object>}     Güncel kullanıcı kaydı
 * @throws  {ApiError}            401 geçersiz/süresi dolmuş, 403 şüpheli kullanım
 */
async function rotateSession(res, presentedToken) {
  if (!presentedToken) {
    throw ApiError.unauthorized('Oturum bulunamadı.');
  }

  // İmza kontrolü veritabanına gitmeden önce yapılıyor: uydurma bir token
  // için sorgu çalıştırmanın anlamı yok, bu da ucuz bir ön eleme.
  let payload;
  try {
    payload = tokenUtil.verifyRefreshToken(presentedToken);
  } catch {
    // Hatanın ayrıntısı (süre mi imza mı) istemciye söylenmiyor; ikisinde de
    // yapılacak şey aynı: yeniden giriş.
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

      // İmza geçerli ama ortada kayıt yok. Bu token bir zamanlar bizim
      // tarafımızdan üretilmiş ama kaydı silinmiş demektir; güvenli tarafta
      // kalıp sızıntı varsayıyoruz.
      if (!stored) {
        throw new SessionCompromisedError(userId, 'unknown_token');
      }

      // Süresi dolmuş token bir saldırı göstergesi değil, sadece eski.
      // Kaydı iptal işaretleyip kullanıcıdan yeniden giriş istiyoruz.
      if (stored.expiresAt.getTime() <= Date.now()) {
        await stored.update({ revokedAt: stored.revokedAt || new Date() }, { transaction });
        return { expired: true };
      }

      if (stored.revokedAt) {
        const sinceRevoke = Date.now() - stored.revokedAt.getTime();
        const inGraceWindow = Boolean(stored.replacedByHash) && sinceRevoke <= REUSE_GRACE_MS;

        // Tolerans yalnızca zincirin devamı hâlâ yaşıyorsa geçerli. Sadece
        // "yakın zamanda rotate edildi mi" diye bakmak yetmiyordu: logout-all
        // ile sonlandırılmış bir oturum da pencere içinde diriltilebiliyordu.
        // Ardıl token da iptalliyse oturum kasıtlı olarak kapatılmış demektir.
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

      // Rol bilgisi token'dan değil veritabanından okunuyor. Token üretildikten
      // sonra kullanıcının yetkisi değişmiş olabilir; eski payload'a güvenmek
      // yetkisi alınmış bir kullanıcıya erişim vermeye devam ederdi.
      const user = await User.findByPk(userId, { transaction });
      if (!user) {
        throw new SessionCompromisedError(userId, 'user_missing');
      }

      const accessToken = tokenUtil.signAccessToken(user);
      const refresh = tokenUtil.signRefreshToken(user);

      // Eski kayıt iptal edilip yerine geçenin özetiyle işaretleniyor; zincir
      // böyle kuruluyor. revokedAt zaten doluysa (tolerans penceresindeki
      // paralel istek) üzerine yazmıyoruz, ilk iptal zamanı korunmalı.
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
    // Şüpheli kullanım burada, yani transaction kapandıktan sonra işleniyor.
    // İçeride yapılsaydı fırlatılan hata rollback'i tetikler ve iptal geri
    // alınırdı; saldırganın token'ı geçerli kalmaya devam ederdi.
    if (err instanceof SessionCompromisedError) {
      await revokeAllForUser(err.userId);
      logger.warn('Şüpheli refresh token kullanımı, tüm oturumlar kapatıldı.', {
        userId: err.userId,
        reason: err.reason,
      });
      // Kullanıcıya teknik ayrıntı verilmiyor; olayın kendisi logda duruyor.
      throw ApiError.forbidden('Oturum güvenliği nedeniyle tüm cihazlardan çıkış yapıldı.');
    }
    // Tanımadığımız hatalar (veritabanı vb.) olduğu gibi yukarı iletiliyor.
    throw err;
  }

  if (result.expired) {
    throw ApiError.unauthorized('Oturum süresi doldu, lütfen tekrar giriş yapın.');
  }

  // Cookie yazma işlemi bilerek transaction'ın dışında ve commit sonrasında.
  // İçeride yazılsaydı ve commit başarısız olsaydı, istemcide veritabanında
  // karşılığı olmayan bir token kalır, sonraki yenileme "sahte token" sayılırdı.
  tokenUtil.setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
  issueCsrfToken(res);

  return result.user;
}

/**
 * Tek cihazın oturumunu kapatır (normal çıkış).
 *
 * Kayıt silinmiyor, iptal işaretleniyor: aynı token sonradan tekrar sunulursa
 * bunun bir sızıntı olduğunu anlayabilmek için geçmişi tutmak gerekiyor.
 * Token yoksa sessizce çıkılıyor, çünkü zaten oturumu olmayan birinin çıkış
 * isteği hata değil.
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
 *
 * Üç yerde kullanılıyor: "tüm cihazlardan çık" işlemi, şifre değişikliği ve
 * şüpheli token kullanımı tespiti. Şifre değiştiğinde de çağrılması önemli;
 * kimlik bilgisi sızmış olabileceği için eski oturumların devam etmesi
 * şifre değiştirmeyi anlamsız kılardı.
 */
async function revokeAllForUser(userId, { transaction } = {}) {
  await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { userId, revokedAt: null }, transaction }
  );
}

/**
 * Yalnızca süresi dolmuş kayıtlar silinir.
 *
 * İptal edilmiş kayıtlar bilinçli olarak kendi ömürleri dolana kadar tutulur:
 * reuse detection "bu token daha önce vardı ve iptal edildi" bilgisine dayanır.
 * İptalliyi erken silmek, çalınmış bir token'ın "hiç görülmemiş" sayılıp
 * kullanıcıya yanlış hata mesajı döndürmesine yol açıyordu. Süresi dolmuş bir
 * token zaten imza doğrulamasını geçemez, o yüzden silinmesi güvenli.
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
