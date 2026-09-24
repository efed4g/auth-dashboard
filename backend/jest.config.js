/**
 * Jest yapılandırması.
 *
 * Testler gerçek bir PostgreSQL'e bağlanıyor, bu yüzden varsayılan 5 saniyelik
 * süre sınırı yetmiyor (bcrypt hash'i tek başına yüzlerce ms).
 */
module.exports = {
  testEnvironment: 'node',
  // Yalnızca .test.js dosyaları; __tests__ altındaki yardımcılar test sanılmasın.
  testMatch: ['**/__tests__/**/*.test.js'],
  testTimeout: 20000,
};