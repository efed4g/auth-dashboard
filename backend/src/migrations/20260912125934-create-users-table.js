'use strict';

/**
 * İlk migration: users tablosunun temel hali. Şema sonraki migration'larla
 * genişletildi; her adım ayrı dosyada tutuluyor ki şema sıfırdan yeniden
 * kurulabilsin.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        // Benzersizlik veritabanı seviyesinde tanımlı: uygulamadaki kontrol
        // eşzamanlı iki kaydı kaçırabilir, kısıt kaçırmaz.
        unique: true
      },
      password: {
        type: Sequelize.STRING,
        // Google ile açılan hesaplarda şifre olmayacağı için null serbest.
        allowNull: true
      },
      role: {
        type: Sequelize.STRING,
        allowNull: false,
        // Yeni kayıtlar en düşük yetkiyle başlıyor.
        defaultValue: 'user'
      }
    });
  },

  // Geri alma adımı: migration'ın test edilebilir olması için up'ın tam tersi.
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('users');
  }
};
