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
      unique: true,
      validate: { isEmail: true },
    },
    // Sadece Google ile giriş yapan kullanıcılarda null.
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'user',
      validate: { isIn: [['user', 'admin']] },
    },
    googleUid: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      field: 'google_uid',
    },
    // Google profilinden gelir; her girişte tazelenir.
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
    // Token'ların kendisi değil SHA-256 özeti saklanır.
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
    defaultScope: {
      // Hassas alanlar kazara response'a sızmasın diye varsayılan olarak seçilmez.
      // Şifrenin varlığı bilgisine ihtiyaç var ama hash'in kendisine yok; bu
      // yüzden boolean olarak SQL tarafında hesaplanıyor.
      attributes: {
        exclude: ['password', 'verificationToken', 'resetPasswordToken'],
        include: [[sequelize.literal('("User"."password" IS NOT NULL)'), 'hasPassword']],
      },
    },
    scopes: {
      withSecrets: { attributes: {} },
    },
  });

  User.associate = (models) => {
    User.hasMany(models.RefreshToken, {
      foreignKey: 'userId',
      as: 'refreshTokens',
      onDelete: 'CASCADE',
    });
  };

  // API response'una konulabilecek güvenli gösterim.
  User.prototype.toPublicJSON = function toPublicJSON() {
    return {
      id: this.id,
      email: this.email,
      role: this.role,
      isVerified: this.isVerified,
      hasGoogleAccount: Boolean(this.googleUid),
      // Arayüz "şifre belirle" mi "şifre değiştir" mi göstereceğine buna bakar.
      // defaultScope'ta SQL'den gelir, withSecrets'ta alanın kendisinden.
      hasPassword: this.get('hasPassword') ?? Boolean(this.password),
      displayName: this.displayName,
      photoUrl: this.photoUrl,
    };
  };

  return User;
};
