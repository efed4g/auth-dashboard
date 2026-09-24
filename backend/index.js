/**
 * Giriş noktası. Express uygulaması src/app.js'te kuruluyor; buradaki tek iş
 * sunucunun ayağa kalkma ve kapanma süreci. Bu ayrım sayesinde app.js'i test
 * ederken gerçek bir port açmaya gerek kalmıyor.
 */
const app = require('./src/app');
const env = require('./src/config/env');
const { sequelize } = require('./src/models');
const logger = require('./src/utils/logger');
const sessionService = require('./src/services/session.service');

// Token ömrü gün mertebesinde olduğu için daha sık taramanın anlamı yok.
const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function start() {
  // authenticate() yalnızca bağlantıyı dener. sequelize.sync() kasıtlı olarak
  // çağrılmıyor: tabloların tek sahibi migration dosyaları.
  await sequelize.authenticate();
  logger.info('Veritabanı bağlantısı kuruldu.');

  const server = app.listen(env.port, () => {
    logger.info('Sunucu çalışıyor.', { url: env.backendUrl, env: env.nodeEnv });
  });

  // Hata loglanıp yutuluyor: yakalanmayan bir promise reddi süreci düşürür.
  const purgeTimer = setInterval(() => {
    sessionService.purgeExpiredTokens().catch((err) => {
      logger.error('Token temizliği başarısız.', { message: err.message });
    });
  }, PURGE_INTERVAL_MS);

  // unref(): bu zamanlayıcı olay döngüsünü tek başına ayakta tutmasın, yoksa
  // süreç kapanma sinyalinden sonra 6 saat beklemeye devam eder.
  purgeTimer.unref();

  // Düzgün kapanma: önce yeni bağlantı kabulü durur, açık istekler bitince
  // havuz kapanır. Doğrudan process.exit() işlenen isteği yarıda keserdi.
  const shutdown = (signal) => {
    logger.info('Kapatma sinyali alındı.', { signal });
    server.close(() => {
      sequelize.close().finally(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Yarı çalışır bir sunucu bırakmak yerine sıfırdan farklı kodla çıkıyoruz;
// süreç yöneticisi bunu görüp yeniden başlatabilsin.
start().catch((err) => {
  logger.error('Sunucu başlatılamadı.', { message: err.message, stack: err.stack });
  process.exit(1);
});
