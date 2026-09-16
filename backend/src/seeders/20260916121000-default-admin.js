'use strict';

const bcrypt = require('bcrypt');

// Rol bazlı erişimi test etmek için admin hesabı.
// Değerler env'den okunur:  ADMIN_EMAIL=... ADMIN_PASSWORD=... yarn seed
module.exports = {
  async up(queryInterface) {
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      console.warn('[seed] ADMIN_EMAIL / ADMIN_PASSWORD tanımlı değil, admin oluşturulmadı.');
      return;
    }
    if (password.length < 8) {
      throw new Error('[seed] ADMIN_PASSWORD en az 8 karakter olmalı.');
    }

    const [existing] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = :email',
      {
        replacements: { email },
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    // Tekrar çalıştırılabilir olsun diye: hesap varsa sadece rolü yükseltilir.
    if (existing) {
      await queryInterface.bulkUpdate('users', { role: 'admin', is_verified: true }, { email });
      console.log(`[seed] Mevcut kullanıcı admin yapıldı: ${email}`);
      return;
    }

    await queryInterface.bulkInsert('users', [{
      email,
      password: await bcrypt.hash(password, 12),
      role: 'admin',
      is_verified: true,
    }]);
    console.log(`[seed] Admin kullanıcı oluşturuldu: ${email}`);
  },

  async down(queryInterface) {
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (!email) return;
    await queryInterface.bulkDelete('users', { email });
  },
};
