'use strict';

/**
 * Şifre sıfırlama akışı için gereken alanlar.
 *
 * Süre alanı (expires) ayrı tutuluyor: token'ın içine süre gömmek yerine
 * veritabanında saklamak, sorguda doğrudan filtrelemeye izin veriyor.
 * Token yine özet halinde saklanıyor.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'reset_password_token', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'reset_password_expires', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'reset_password_token');
    await queryInterface.removeColumn('users', 'reset_password_expires');
  }
};
