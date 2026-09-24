/**
 * User modeli — users tablosu.
 *
 * E-posta+şifre ve Google girişi tek kayıtta taşınıyor; aynı kişinin ikisini
 * birden kullanması mümkün olsun diye. Bedeli: password null olabiliyor.
 * Alan adları JS'te camelCase, veritabanında snake_case (`field` ile eşleniyor).
 */
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      // Kısıt veritabanı seviyesinde: uygulamadaki "önce sorgula sonra ekle"
      // kontrolü eşzamanlı iki isteği kaçırabilir.
      unique: true,
      validate: { isEmail: true },
    },
    // Yalnızca Google ile açılan hesaplarda null; sonradan şifre belirlenebiliyor.
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      // Yeni kayıtlar en düşük yetkiyle başlar; admin yapmak ayrı bir işlem.
      defaultValue: 'user',
      validate: { isIn: [['user', 'admin']] },
    },
    // Eşleştirmede e-postadan önce buna bakılıyor: kullanıcı Google
    // e-postasını değiştirse bile aynı hesaba bağlı kalıyor.
    googleUid: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      field: 'google_uid',
    },
    // Google profilinden gelir, her girişte güncellenir.
    displayName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'display_name',
    },
    photoUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'photo_url',
    },

    // Soft delete bayrağı: kayıt silinmez, false işaretlenir; geri dönüş mümkün.
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },

    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_verified',
    },
    // Token'ların kendisi değil SHA-256 özeti (64 karakter) tutuluyor:
    // veritabanı sızsa bile bu değerlerle hesap doğrulanamaz, şifre sıfırlanamaz.
    verificationToken: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'verification_token',
    },
    verificationTokenExpires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verification_token_expires',
    },
    resetPasswordToken: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'reset_password_token',
    },
    resetPasswordExpires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reset_password_expires',
    },
  }, {
    tableName: 'users',
    timestamps: false,
    /**
     * Hassas alanlar SELECT'e hiç dahil edilmiyor: belleğe gelmeyen veri
     * kazara serialize de edilemez.
     *
     * hasPassword arayüzün "şifre belirle" mi "şifre değiştir" mi göstereceğine
     * karar vermesi için gerekli; hash'i taşımamak adına SQL'de boolean üretiliyor.
     */
    defaultScope: {
      attributes: {
        exclude: ['password', 'verificationToken', 'resetPasswordToken'],
        include: [[sequelize.literal('("User"."password" IS NOT NULL)'), 'hasPassword']],
      },
    },
    // Şifre doğrulama ve token eşleştirmede gizli alanlar gerekli. Bu kapsamı
    // kullanan her yer bilinçli bir tercih yapmış oluyor.
    scopes: {
      withSecrets: { attributes: {} },
    },
  });

  User.associate = (models) => {
    // Bir kullanıcının birden fazla aktif cihazı olabilir. CASCADE: kullanıcı
    // silinirse sahipsiz oturum kaydı kalmasın.
    User.hasMany(models.RefreshToken, {
      foreignKey: 'userId',
      as: 'refreshTokens',
      onDelete: 'CASCADE',
    });

    User.hasOne(models.Profile, {
      foreignKey: 'userId',
      as: 'profile',
      onDelete: 'CASCADE',
    });
  };

  /**
   * API cevabına konulabilecek gösterim. Modeli doğrudan res.json'a vermek
   * yerine kullanılıyor: yeni bir sütun eklendiğinde istemeden sızmıyor.
   */
  User.prototype.toPublicJSON = function toPublicJSON() {
    return {
      id: this.id,
      email: this.email,
      role: this.role,
      isActive: this.isActive,
      isVerified: this.isVerified,
      hasGoogleAccount: Boolean(this.googleUid),
      // Varsayılan kapsamda SQL'in ürettiği sanal alan, withSecrets'ta alanın
      // kendisinden türetiliyor.
      hasPassword: this.get('hasPassword') ?? Boolean(this.password),
      displayName: this.displayName,
      photoUrl: this.photoUrl,
    };
  };

  return User;
};
