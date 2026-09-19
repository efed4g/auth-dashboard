/**
 * sequelize-cli'nin (migration ve seed komutları) okuduğu yapılandırma.
 *
 * Uygulamanın kendi bağlantısı database.js'te; burası ayrı çünkü CLI kendi
 * süreci olarak çalışıyor ve bu dosyayı isim olarak arıyor. env.js'i require
 * etmemizin sebebi de bu: CLI süreci .env dosyasını aksi halde hiç okumaz,
 * DATABASE_URL tanımsız kalır ve migration çalışmaz.
 */
const env = require('./env');

// use_env_variable: bağlantı bilgilerini alan alan yazmak yerine CLI'ya
// DATABASE_URL'i okumasını söylüyor. Böylece adres tek bir yerde tanımlı
// kalıyor ve kullanıcı adı/şifre bu dosyaya düşmüyor.
const base = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
  logging: env.databaseLogging ? console.log : false,
};

module.exports = {
  development: base,
  test: base,
  // Production'daki tek fark TLS zorunluluğu; bkz. config/database.js.
  production: {
    ...base,
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false },
    },
  },
};
