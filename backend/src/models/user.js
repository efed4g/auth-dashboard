/**
 * User modeli — users tablosu.
 *
 * Tablo iki farklı giriş yöntemini tek kayıtta taşıyor: e-posta + şifre ve
 * Google. Ayrı tablolar açmak yerine bunu tercih ettim, çünkü aynı kişinin iki
 * yöntemi de kullanması mümkün ve iki tablo olsaydı her seferinde eşleştirme
 * yapmak gerekirdi. Bunun bedeli password alanının null olabilmesi.
 *
 * Alan adları JS tarafında camelCase, veritabanında snake_case (`field`
 * seçeneğiyle eşleniyor) — her iki tarafın kendi yazım geleneğine uyması için.
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
      // Benzersizlik kısıtı veritabanı seviyesinde: uygulamadaki "önce sorgula,
      // sonra ekle" kontrolü eşzamanlı iki isteği kaçırabilir, kısıt kaçırmaz.
      unique: true,
      validate: { isEmail: true },
    },
    // Yalnızca Google ile açılan hesaplarda null. Kullanıcı isterse sonradan
    // şifre belirleyebiliyor (bkz. auth.controller.js -> setPassword).
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      // Yeni kayıtlar her zaman en düşük yetkiyle başlıyor; admin yapmak
      // ayrı ve bilinçli bir işlem (seed ya da elle güncelleme).
      defaultValue: 'user',
      validate: { isIn: [['user', 'admin']] },
    },
    // Google'ın kullanıcı için ürettiği kalıcı kimlik. Eşleştirmede e-postadan
    // önce buna bakılıyor: kullanıcı Google hesabının e-postasını değiştirse
    // bile aynı hesaba bağlanmaya devam ediyor.
    googleUid: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      field: 'google_uid',
    },
    // Ad ve fotoğraf Google profilinden geliyor, her girişte güncelleniyor.
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
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_verified',
    },
    // Doğrulama ve sıfırlama token'larının kendisi değil SHA-256 özeti tutuluyor
    // (64 karakter). Veritabanı sızsa bile bu değerlerle kimse hesap
    // doğrulayamaz ya da şifre sıfırlayamaz.
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
     * Varsayılan sorgu kapsamı.
     *
     * Hassas alanlar SELECT'e hiç dahil edilmiyor. "Response'a eklemeyi
     * unutmamak" yerine "hiç okumamak" tercih edildi: veri belleğe gelmezse
     * kazara serialize edilmesi de mümkün olmuyor.
     *
     * hasPassword ise arayüzün "şifre belirle" mi "şifre değiştir" mi
     * göstereceğine karar vermesi için gerekli. Hash'in kendisini taşımamak
     * adına bu bilgi SQL tarafında boolean olarak hesaplanıyor.
     */
    defaultScope: {
      attributes: {
        exclude: ['password', 'verificationToken', 'resetPasswordToken'],
        include: [[sequelize.literal('("User"."password" IS NOT NULL)'), 'hasPassword']],
      },
    },
    // Şifre doğrulama ve token eşleştirme gibi işlemlerde gizli alanlar gerekli.
    // Bu kapsamı kullanan her yer bilinçli bir tercih yapmış oluyor.
    scopes: {
      withSecrets: { attributes: {} },
    },
  });

  // Bir kullanıcının birden fazla aktif oturumu (cihazı) olabilir, bu yüzden
  // hasMany. CASCADE: kullanıcı silinirse ona ait token kayıtları da gitsin,
  // ortada sahipsiz oturum kalmasın.
  User.associate = (models) => {
    User.hasMany(models.RefreshToken, {
      foreignKey: 'userId',
      as: 'refreshTokens',
      onDelete: 'CASCADE',
    });
  };

  /**
   * Kullanıcının API cevabına konulabilecek gösterimi.
   *
   * Modeli doğrudan res.json'a vermek yerine bu yöntemi kullanıyoruz: hangi
   * alanların dışarı çıktığı burada açıkça yazılı, tabloya yeni bir sütun
   * eklendiğinde istemeden sızmıyor.
   *
   * @returns {object} Kimlik, rol ve giriş yöntemi bilgileri
   */
  User.prototype.toPublicJSON = function toPublicJSON() {
    return {
      id: this.id,
      email: this.email,
      role: this.role,
      isVerified: this.isVerified,
      hasGoogleAccount: Boolean(this.googleUid),
      // Kayıt hangi kapsamla okunduysa oradan geliyor: varsayılan kapsamda
      // SQL'in hesapladığı sanal alan, withSecrets'ta alanın kendisi dolu
      // olduğu için ondan türetiliyor.
      hasPassword: this.get('hasPassword') ?? Boolean(this.password),
      displayName: this.displayName,
      photoUrl: this.photoUrl,
    };
  };

  return User;
};
