/**
 * Model kayıt merkezi.
 *
 * Modelleri tek tek require etmek yerine klasör taranıyor: yeni bir model
 * eklemek için src/models/<ad>.js oluşturmak yetiyor, bu dosyaya dokunmak
 * gerekmiyor. Her model dosyası (sequelize, DataTypes) alan bir fabrika
 * fonksiyonu dışa aktarıyor; modeli burada kurmak, bağlantının tek örnek
 * kalmasını da garanti ediyor.
 *
 * Kullanımı:  const { User, RefreshToken, sequelize } = require('../models');
 */
const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const db = {};
const basename = path.basename(__filename);

// Kendini (index.js) ve .js olmayanları atlıyoruz; nokta ile başlayan dosyalar
// da editör/sistem artığı olabileceği için eleniyor.
fs.readdirSync(__dirname)
  .filter((file) => file !== basename && file.endsWith('.js') && !file.startsWith('.'))
  .forEach((file) => {
    const define = require(path.join(__dirname, file));
    const model = define(sequelize, DataTypes);
    db[model.name] = model;
  });

// İlişkiler ayrı bir turda kuruluyor. Model dosyası kendi içinde associate
// çağırsaydı, henüz yüklenmemiş bir modele referans verdiğinde hata alırdı;
// bu ayrım sayesinde dosyaların okunma sırası önemsiz hale geliyor.
Object.values(db).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(db);
  }
});

// Servislerin transaction açabilmesi için bağlantının kendisi de dışa veriliyor.
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
