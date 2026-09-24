/**
 * Model kayıt merkezi. Klasör taranıyor: yeni model eklemek için
 * src/models/<ad>.js oluşturmak yetiyor, bu dosyaya dokunmak gerekmiyor.
 *
 * Kullanımı: const { User, RefreshToken, sequelize } = require('../models');
 */
const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const db = {};
const basename = path.basename(__filename);

// Kendini, .js olmayanları ve editör/sistem artığı olabilecek nokta ile
// başlayan dosyaları atlıyor.
fs.readdirSync(__dirname)
  .filter((file) => file !== basename && file.endsWith('.js') && !file.startsWith('.'))
  .forEach((file) => {
    const define = require(path.join(__dirname, file));
    const model = define(sequelize, DataTypes);
    db[model.name] = model;
  });

// İlişkiler ayrı turda kuruluyor: model dosyası kendi içinde associate
// çağırsaydı henüz yüklenmemiş bir modele referans verebilirdi.
Object.values(db).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(db);
  }
});

// Servislerin transaction açabilmesi için bağlantının kendisi de dışa veriliyor.
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
