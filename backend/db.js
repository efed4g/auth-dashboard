const { Pool } = require('pg');
// bağlantı havuzunu başlatıyoruz
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
module.exports = pool;