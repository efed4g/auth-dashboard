/**
 * RefreshToken modeli — refresh_tokens tablosu.
 *
 * JWT durum tutmaz: imzası geçerli olduğu sürece kabul edilir, bu da "çıkış
 * yap" işlemini anlamsız kılar. Refresh token'ları veritabanında izleyerek bu
 * çözülüyor — bir token ancak kaydı varsa ve iptal edilmemişse geçerli.
 * Tablo ayrıca rotasyon zincirini tutuyor (bkz. services/session.service.js).
 */
module.exports = (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define('RefreshToken', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
    // Token'ın kendisi değil SHA-256 özeti: veritabanı ele geçirilse bile
    // ham token bu özetten geri üretilemiyor.
    tokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      field: 'token_hash',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
    // Kayıt silinmiyor, iptal ediliyor: "vardı ama iptal edildi" bilgisi
    // çalınmış token kullanımını tespit etmenin temeli.
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'revoked_at',
    },
    // Zincirin sonraki halkası. Rotasyondan hemen sonraki paralel isteklerin
    // saldırı mı yarış durumu mu olduğunu ayırt etmek için.
    replacedByHash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'replaced_by_hash',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
  }, {
    tableName: 'refresh_tokens',
    timestamps: false,
  });

  RefreshToken.associate = (models) => {
    RefreshToken.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  // İki koşul birlikte sağlanmalı. Kontrolü modele koymak, aynı koşulun farklı
  // yerlerde eksik yazılmasını engelliyor.
  RefreshToken.prototype.isActive = function isActive() {
    return !this.revokedAt && this.expiresAt.getTime() > Date.now();
  };

  return RefreshToken;
};
