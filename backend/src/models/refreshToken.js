/**
 * RefreshToken modeli — refresh_tokens tablosu.
 *
 * JWT'nin kendisi durum tutmaz; imzası geçerli olduğu sürece kabul edilir.
 * Bu da "çıkış yap" işlemini anlamsız kılar, çünkü dağıtılmış bir token'ı geri
 * çağırmanın yolu yoktur. Refresh token'ları veritabanında izleyerek bu sorunu
 * çözüyoruz: bir token ancak burada kaydı varsa ve iptal edilmemişse geçerli.
 *
 * Tablo aynı zamanda rotasyon zincirinin kaydını tutuyor; hangi token'ın
 * yerine hangisinin geçtiği bilindiği için çalınmış token kullanımı fark
 * edilebiliyor (bkz. services/session.service.js).
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
    // Token'ın kendisi değil SHA-256 özeti saklanıyor. Veritabanı ele
    // geçirilse bile buradaki değerlerle oturum açılamaz, çünkü sunucuya
    // sunulması gereken ham token bu özetten geri üretilemiyor.
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
    // Rotasyonda ve çıkışta kayıt silinmiyor, iptal ediliyor. Silinseydi
    // çalınmış bir token sunulduğunda "hiç var olmamış" gibi görünürdü;
    // "vardı ama iptal edildi" bilgisi saldırıyı tespit etmenin temeli.
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'revoked_at',
    },
    // Zincirin bir sonraki halkası. Rotasyondan hemen sonra gelen paralel
    // isteklerin gerçek bir saldırı mı yoksa yarış durumu mu olduğunu
    // ayırt etmek için kullanılıyor.
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

  // Bir token'ın kullanılabilir olması için iki koşul birlikte sağlanmalı:
  // iptal edilmemiş ve süresi dolmamış olmak. Kontrolü modele koymak, aynı
  // koşulun farklı yerlerde eksik yazılmasını engelliyor.
  RefreshToken.prototype.isActive = function isActive() {
    return !this.revokedAt && this.expiresAt.getTime() > Date.now();
  };

  return RefreshToken;
};
