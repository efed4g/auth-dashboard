'use strict';

/**
 * Profil fotoğrafı alanları.
 *
 * users.photo_url her Google girişinde üzerine yazıldığı için kullanıcının
 * yüklediği fotoğraf oraya konamıyor; profilin kendi alanı açılıyor.
 *
 * photo_public_id ayrı: Cloudinary'de silme işlemi adresi değil servisin
 * verdiği kimliği istiyor.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('profiles', 'photo_url', {
        // TEXT: imza içeren bulut adresleri 255 karakteri aşabiliyor.
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('profiles', 'photo_public_id', {
        type: Sequelize.STRING,
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
      await queryInterface.removeColumn('profiles', 'photo_public_id', { transaction });
      await queryInterface.removeColumn('profiles', 'photo_url', { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
