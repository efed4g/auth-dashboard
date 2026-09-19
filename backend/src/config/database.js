/**
 * Uygulamanın kullandığı tek Sequelize örneği.
 *
 * Bağlantı ayrı bir dosyada tutuluyor ki modeller de, servisler de aynı
 * havuzu paylaşsın. Her modülde yeni bir Sequelize nesnesi kurulsaydı
 * veritabanı bağlantı havuzu gereksiz yere çoğalırdı.
 */
const { Sequelize } = require('sequelize');
const env = require('./env');

const sequelize = new Sequelize(env.databaseUrl, {
  dialect: 'postgres',
  // SQL çıktısı varsayılan olarak kapalı; DB_LOGGING=true ile açılabiliyor.
  // Sürekli açık bırakmak logları okunamaz hale getiriyor.
  logging: env.databaseLogging ? console.log : false,
  // Bulut sağlayıcılarının PostgreSQL servisleri TLS zorunlu tutuyor.
  // rejectUnauthorized: false, bu servislerin kendinden imzalı sertifikaları
  // için gerekli; local geliştirmede TLS hiç devreye girmiyor.
  dialectOptions: env.isProduction
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
});

module.exports = sequelize;
