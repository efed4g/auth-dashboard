'use strict';

/**
 * E-posta doğrulama akışı için gereken alanlar.
 *
 * defaultValue: false — mevcut kayıtlar da doğrulanmamış sayılıyor.
 * verification_token'da token'ın kendisi değil SHA-256 özeti tutuluyor.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'is_verified', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
    await queryInterface.addColumn('users', 'verification_token', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'is_verified');
    await queryInterface.removeColumn('users', 'verification_token');
  }
};
