'use strict';

/**
 * Hesap devre dışı bırakma için isActive bayrağı.
 *
 * Kaydı silmek yerine işaretliyoruz (soft delete): kullanıcı geri dönmek
 * isterse verisi duruyor, ona bağlı profil ve oturum kayıtları öksüz kalmıyor.
 *
 * Varsayılan true — mevcut kullanıcıların hepsi aktif kabul ediliyor.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'is_active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'is_active');
  },
};