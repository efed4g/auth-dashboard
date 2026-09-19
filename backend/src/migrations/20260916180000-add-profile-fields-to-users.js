'use strict';

/**
 * Google profil bilgileri için alanlar.
 *
 * Değerler Firebase ID token'ındaki name ve picture claim'lerinden geliyor ve
 * her girişte tazeleniyor. Kopya tutmak yerine her seferinde Google'a sormak
 * da mümkündü ama bu, arayüzün her açılışında dış servise bağımlı olmak demek.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('users', 'display_name', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });

      // Google avatar adresleri uzun olabiliyor, STRING(255) yetmeyebilir.
      await queryInterface.addColumn('users', 'photo_url', {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('users', 'photo_url', { transaction });
      await queryInterface.removeColumn('users', 'display_name', { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
