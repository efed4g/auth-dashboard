const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Modeller otomatik yüklenir: bu klasöre <model>.js eklemek yeterli.
// Her dosya (sequelize, DataTypes) alan bir fabrika fonksiyonu dışa aktarır.
const db = {};
const basename = path.basename(__filename);

fs.readdirSync(__dirname)
  .filter((file) => file !== basename && file.endsWith('.js') && !file.startsWith('.'))
  .forEach((file) => {
    const define = require(path.join(__dirname, file));
    const model = define(sequelize, DataTypes);
    db[model.name] = model;
  });

// İlişkiler tüm modeller tanımlandıktan sonra kurulur.
Object.values(db).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
