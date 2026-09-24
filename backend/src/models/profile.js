/**
 * Profile modeli — profiles tablosu.
 *
 * users'tan ayrı: kimlik doğrulama her istekte users kaydını okuyor, profil
 * alanları ise yalnızca profil ekranında gerekiyor. İlişki bire bir, kural
 * veritabanında UNIQUE kısıtıyla garanti altında.
 */
module.exports = (sequelize, DataTypes) => {
  const Profile = sequelize.define('Profile', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: 'user_id',
    },
    firstName: {
      type: DataTypes.STRING(60),
      allowNull: false,
      field: 'first_name',
    },
    lastName: {
      type: DataTypes.STRING(60),
      allowNull: false,
      field: 'last_name',
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    birthDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'birth_date',
    },
    city: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    district: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    bio: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    // users.photoUrl'den ayrı: orası Google profilinden gelip her girişte
    // tazeleniyor, burası kullanıcının kendi yüklediği fotoğraf.
    photoUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'photo_url',
    },
    // Depodan silebilmek için servisin verdiği kimlik.
    photoPublicId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'photo_public_id',
    },
  }, {
    tableName: 'profiles',
    // Diğer modellerden farklı olarak açık: güncellemede updated_at
    // kendiliğinden tazelensin.
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  Profile.associate = (models) => {
    Profile.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  /** API cevabına konulabilecek gösterim. */
  Profile.prototype.toPublicJSON = function toPublicJSON() {
    return {
      id: this.id,
      firstName: this.firstName,
      lastName: this.lastName,
      phone: this.phone,
      birthDate: this.birthDate,
      city: this.city,
      district: this.district,
      address: this.address,
      bio: this.bio,
      photoUrl: this.photoUrl,
      createdAt: this.created_at ?? this.get('created_at'),
      updatedAt: this.updated_at ?? this.get('updated_at'),
    };
  };

  return Profile;
};