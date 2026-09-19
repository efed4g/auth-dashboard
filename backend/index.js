/**
 * Uygulamanın giriş noktası.
 *
 * Express uygulamasının kendisi src/app.js içinde kuruluyor. Buradaki tek iş,
 * sunucunun ayağa kalkma ve kapanma sürecini yönetmek: veritabanı bağlantısını
 * doğrulamak, portu dinlemeye başlamak, periyodik temizlik görevini kurmak ve
 * kapanma sinyallerini karşılamak. Bu ayrım sayesinde app.js'i test ederken
 * gerçek bir port açmaya gerek kalmıyor.
 */
const app = require('./src/app');
const env = require('./src/config/env');
const { sequelize } = require('./src/models');
const logger = require('./src/utils/logger');
const sessionService = require('./src/services/session.service');

// Süresi dolan refresh token kayıtlarını 6 saatte bir tarıyoruz. Daha sık
// çalıştırmanın anlamı yok, token ömrü gün mertebesinde.
const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function start() {
  // authenticate() yalnızca bağlantıyı dener, şemaya dokunmaz. sequelize.sync()
  // burada kasıtlı olarak çağrılmıyor: tabloların tek sahibi migration dosyaları.
  // sync() devreye girse migration'ları atlayıp şemayı sessizce değiştirebilirdi.
  await sequelize.authenticate();
  logger.info('Veritabanı bağlantısı kuruldu.');

  const server = app.listen(env.port, () => {
    logger.info('Sunucu çalışıyor.', { url: env.backendUrl, env: env.nodeEnv });
  });

  // Temizlik görevi sunucunun geri kalanını etkilememeli: hata fırlatırsa
  // loglanıp yutuluyor, yoksa yakalanmayan bir promise reddi süreci düşürür.
  const purgeTimer = setInterval(() => {
    sessionService.purgeExpiredTokens().catch((err) => {
      logger.error('Token temizliği başarısız.', { message: err.message });
    });
  }, PURGE_INTERVAL_MS);

  // unref(): bu zamanlayıcı tek başına Node'un olay döngüsünü ayakta tutmasın,
  // yoksa süreç kapanma sinyalinden sonra da 6 saat boyunca beklemeye devam eder.
  purgeTimer.unref();

  /**
   * Düzgün kapanma. Önce yeni bağlantı kabulü durdurulur, açık istekler bitince
   * veritabanı havuzu kapatılır. Doğrudan process.exit() çağırmak, o sırada
   * işlenen bir isteği yarıda keserdi.
   */
  const shutdown = (signal) => {
    logger.info('Kapatma sinyali alındı.', { signal });
    server.close(() => {
      sequelize.close().finally(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Açılış sırasında hata çıkarsa (eksik env değişkeni, kapalı veritabanı...)
// yarı çalışır bir sunucu bırakmak yerine sıfırdan farklı kodla çıkıyoruz;
// süreç yöneticisi bunu görüp yeniden başlatabilsin.
start().catch((err) => {
  logger.error('Sunucu başlatılamadı.', { message: err.message, stack: err.stack });
  process.exit(1);
});
