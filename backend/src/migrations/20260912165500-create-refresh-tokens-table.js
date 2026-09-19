'use strict';

/**
 * refresh_tokens tablosunun ilk hali.
 *
 * Bu aşamada token'lar henüz düz metin saklanıyordu; rotasyon ve iptal
 * alanları sonraki migration'da (harden-auth-schema) eklendi. Adımı geriye
 * dönük düzeltmek yerine olduğu gibi bıraktım, şemanın nasıl geliştiği
 * migration geçmişinden okunabilsin.
 *
 * ON DELETE CASCADE: kullanıcı silindiğinde oturum kayıtları da gitsin,
 * sahipsiz satır kalmasın.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('refresh_tokens', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      token: {
        type: Sequelize.STRING,
        allowNull: false
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('refresh_tokens');
  }
};
