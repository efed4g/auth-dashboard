'use strict';

/**
 * Oturum şemasının güvenlik güncellemesi.
 *
 * Üç değişiklik bir arada:
 *  1. Refresh token'lar artık düz metin değil SHA-256 özetiyle saklanıyor.
 *  2. Rotasyon ve iptal için revoked_at / replaced_by_hash alanları eklendi.
 *  3. Google hesabı eşleştirmesi için google_uid eklendi.
 *
 * Mevcut düz metin kayıtlar özete dönüştürülemez (hash tek yönlü), bu yüzden
 * tablo boşaltılıyor. Pratik sonucu: o an açık olan oturumlar kapanıyor ve
 * kullanıcılar bir kez yeniden giriş yapıyor. Veri kaybı olmayan, kabul
 * edilebilir bir bedel.
 *
 * Tüm adımlar tek transaction'da: ortadaki bir adım hata verirse tablo
 * yarı dönüştürülmüş halde kalmasın, ya hepsi uygulansın ya hiçbiri.
 */
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

      // "Tüm cihazlardan çık" ve aktif oturum sayımı her seferinde user_id
      // üzerinden filtreliyor; indeks olmadan tablo büyüdükçe tam tarama olurdu.
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
