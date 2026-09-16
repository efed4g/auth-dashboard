const app = require('./src/app');
const env = require('./src/config/env');
const { sequelize } = require('./src/models');
const logger = require('./src/utils/logger');
const sessionService = require('./src/services/session.service');

const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function start() {
  // Şema migration'larla yönetiliyor; sequelize.sync() bilinçli kullanılmıyor.
  await sequelize.authenticate();
  logger.info('Veritabanı bağlantısı kuruldu.');

  const server = app.listen(env.port, () => {
    logger.info('Sunucu çalışıyor.', { url: env.backendUrl, env: env.nodeEnv });
  });

  const purgeTimer = setInterval(() => {
    sessionService.purgeExpiredTokens().catch((err) => {
      logger.error('Token temizliği başarısız.', { message: err.message });
    });
  }, PURGE_INTERVAL_MS);
  purgeTimer.unref();

  const shutdown = (signal) => {
    logger.info('Kapatma sinyali alındı.', { signal });
    server.close(() => {
      sequelize.close().finally(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('Sunucu başlatılamadı.', { message: err.message, stack: err.stack });
  process.exit(1);
});
