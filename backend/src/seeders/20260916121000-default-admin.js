'use strict';

const bcrypt = require('bcrypt');

/**
 * Rol bazlı erişimi denemek için admin hesabı oluşturur.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... yarn seed
 *
 * Şifre dosyaya yazılmıyor: repoya girip production'a taşınma riski taşır.
 * Değer verilmezse hesap hiç oluşturulmuyor.
 */
module.exports = {
  async up(queryInterface) {
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    // Uyarı, hata değil: seed diğer seed'lerle birlikte çalıştırıldığında
    // admin tanımlı olmaması akışı durdurmamalı.
    if (!email || !password) {
      console.warn('[seed] ADMIN_EMAIL / ADMIN_PASSWORD tanımlı değil, admin oluşturulmadı.');
      return;
    }
    // Burada hata fırlatılıyor: kullanıcı admin istediğini belirtmiş, zayıf
    // şifreyle sessizce devam etmek yanlış olurdu.
    if (password.length < 8) {
      throw new Error('[seed] ADMIN_PASSWORD en az 8 karakter olmalı.');
    }

    // Model katmanı kullanılmıyor (seeder'lar modelden bağımsız çalışmalı).
    // replacements ile parametreli sorgu: değeri string olarak eklemek SQL
    // injection'a açık kapı bırakırdı.
    const [existing] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = :email',
      {
        replacements: { email },
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    // Tekrar çalıştırılabilir olsun diye: hesap varsa mevcut kullanıcı admin
    // yapılıyor. Kendi hesabını yükseltmek de böyle mümkün.
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
