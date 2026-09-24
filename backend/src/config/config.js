/**
 * sequelize-cli'nin (migration ve seed komutları) okuduğu yapılandırma.
 *
 * Uygulamanın kendi bağlantısı database.js'te; burası ayrı çünkü CLI kendi
 * süreci olarak çalışıp bu dosyayı isim olarak arıyor. env.js require
 * edilmezse CLI .env dosyasını hiç okumaz ve DATABASE_URL tanımsız kalır.
 */
const env = require('./env');

// use_env_variable: bağlantı bilgileri alan alan yazılmıyor, CLI DATABASE_URL'i
// okuyor. Böylece kullanıcı adı/şifre bu dosyaya düşmüyor.
const base = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
  logging: env.databaseLogging ? console.log : false,
};

module.exports = {
  development: base,
  test: base,
  // Tek fark TLS zorunluluğu; bkz. config/database.js.
  production: {
    ...base,
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false },
    },
  },
};
