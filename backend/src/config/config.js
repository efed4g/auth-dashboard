// sequelize-cli (migration/seed) konfigürasyonu.
// env.js require edildiği için .env dosyası CLI tarafında da yüklenir.
const env = require('./env');

const base = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
  logging: env.databaseLogging ? console.log : false,
};

module.exports = {
  development: base,
  test: base,
  production: {
    ...base,
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false },
    },
  },
};
