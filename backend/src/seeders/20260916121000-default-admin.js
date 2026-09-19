'use strict';

const bcrypt = require('bcrypt');

/**
 * Rol bazlı erişimi denemek için admin hesabı oluşturur.
 *
 * E-posta ve şifre env'den okunuyor, dosyaya yazılmıyor:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... yarn seed
 *
 * Sabit bir şifre yazmak en kolayı olurdu ama o şifre repoya girer ve
 * production'a da taşınma riski taşır. Değer verilmediğinde hesap hiç
 * oluşturulmuyor, yani kimse farkında olmadan bilinen şifreli bir yönetici
 * hesabıyla kalmıyor.
 */
module.exports = {
  async up(queryInterface) {
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    // Değer yoksa hata değil uyarı: seed komutu diğer seed'lerle birlikte
    // çalıştırıldığında admin tanımlı olmaması akışı durdurmamalı.
    if (!email || !password) {
      console.warn('[seed] ADMIN_EMAIL / ADMIN_PASSWORD tanımlı değil, admin oluşturulmadı.');
      return;
    }
    // Burada ise hata fırlatılıyor: kullanıcı admin oluşturmak istediğini
    // belirtmiş, zayıf şifreyle sessizce devam etmek yanlış olurdu.
    if (password.length < 8) {
      throw new Error('[seed] ADMIN_PASSWORD en az 8 karakter olmalı.');
    }

    // Seeder'da model katmanı kullanılmıyor (migration'lar modelden bağımsız
    // çalışmalı), bu yüzden ham sorgu. replacements ile parametreli
    // çalıştırılıyor; değeri string olarak sorguya eklemek SQL injection'a
    // açık kapı bırakırdı.
    const [existing] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = :email',
      {
        replacements: { email },
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    // Seeder'ın tekrar çalıştırılabilir olması için: hesap zaten varsa yeni
    // kayıt açmak yerine mevcut kullanıcı admin yapılıyor. Böylece kendi
    // hesabını admin'e yükseltmek de mümkün oluyor.
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
