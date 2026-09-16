'use strict';

// Refresh token'ları SHA-256 özetiyle saklamaya geçiş, rotasyon/iptal alanları
// ve Google hesabı eşleştirmesi için google_uid.
// Mevcut düz metin kayıtlar taşınamaz, temizlenir (bir kez yeniden giriş gerekir).
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('users', 'google_uid', {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      }, { transaction });

      await queryInterface.addColumn('users', 'verification_token_expires', {
        type: Sequelize.DATE,
        allowNull: true,
      }, { transaction });

      await queryInterface.bulkDelete('refresh_tokens', null, { transaction });
      await queryInterface.removeColumn('refresh_tokens', 'token', { transaction });

      await queryInterface.addColumn('refresh_tokens', 'token_hash', {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      }, { transaction });

      await queryInterface.addColumn('refresh_tokens', 'expires_at', {
        type: Sequelize.DATE,
        allowNull: false,
      }, { transaction });

      await queryInterface.addColumn('refresh_tokens', 'revoked_at', {
        type: Sequelize.DATE,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('refresh_tokens', 'replaced_by_hash', {
        type: Sequelize.STRING(64),
        allowNull: true,
      }, { transaction });

      await queryInterface.addIndex('refresh_tokens', ['user_id'], {
        name: 'refresh_tokens_user_id_idx',
        transaction,
      });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeIndex('refresh_tokens', 'refresh_tokens_user_id_idx', { transaction });
      await queryInterface.removeColumn('refresh_tokens', 'replaced_by_hash', { transaction });
      await queryInterface.removeColumn('refresh_tokens', 'revoked_at', { transaction });
      await queryInterface.removeColumn('refresh_tokens', 'expires_at', { transaction });
      await queryInterface.bulkDelete('refresh_tokens', null, { transaction });
      await queryInterface.removeColumn('refresh_tokens', 'token_hash', { transaction });

      await queryInterface.addColumn('refresh_tokens', 'token', {
        type: Sequelize.STRING,
        allowNull: false,
      }, { transaction });

      await queryInterface.removeColumn('users', 'verification_token_expires', { transaction });
      await queryInterface.removeColumn('users', 'google_uid', { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
