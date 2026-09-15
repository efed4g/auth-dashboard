'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Tabloyu oluşturma işlemi
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
        unique: true // Aynı e-posta ile iki kişi kayıt olamaz
      },
      password: {
        type: Sequelize.STRING,
        allowNull: true // Google ile girenler için boş olabilir demiştik
      },
      role: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'user' // Varsayılan rol 'user' olarak atanıyor
      }
    });
  },

  async down(queryInterface, Sequelize) {
    // İşlemi geri alırsak tabloyu sil
    await queryInterface.dropTable('users');
  }
};
