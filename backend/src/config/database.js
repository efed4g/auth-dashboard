/**
 * Uygulamanın kullandığı tek Sequelize örneği. Her modülde yeni bir nesne
 * kurulsaydı bağlantı havuzu gereksiz yere çoğalırdı.
 */
const { Sequelize } = require('sequelize');
const env = require('./env');

const sequelize = new Sequelize(env.databaseUrl, {
  dialect: 'postgres',
  // DB_LOGGING=true ile açılabiliyor; sürekli açık bırakmak logları okunmaz yapıyor.
  logging: env.databaseLogging ? console.log : false,
  // Bulut PostgreSQL servisleri TLS zorunlu tutuyor; rejectUnauthorized: false
  // onların kendinden imzalı sertifikaları için gerekli.
  dialectOptions: env.isProduction
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
});

module.exports = sequelize;
