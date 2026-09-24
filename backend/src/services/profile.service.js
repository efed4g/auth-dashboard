/**
 * Profil iş mantığı. HTTP bilmez; kimlik olarak aldığı userId her zaman
 * doğrulanmış token'dan gelir, bu yüzden ayrıca yetki kontrolü gerekmez.
 */
const { Profile } = require('../models');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');
const storage = require('./storage.service');

// Profili olmamak hata değil, yeni kullanıcının normal durumu: null dönülüyor.
async function getProfile(userId) {
  return Profile.findOne({ where: { userId } });
}

async function createProfile(userId, data) {
  // Asıl güvence veritabanındaki UNIQUE kısıt; bu kontrol sadece okunur mesaj için.
  const existing = await Profile.findOne({ where: { userId } });
  if (existing) {
    throw ApiError.conflict('Bu hesabın profili zaten var. Güncellemek için düzenleme formunu kullanın.');
  }

  // userId gövdeden değil parametreden: aksi halde herkes başkası adına profil açabilirdi.
  const profile = await Profile.create({ ...data, userId });
  logger.info('Profil oluşturuldu.', { userId });

  return profile;
}

async function updateProfile(userId, data) {
  // Kayıt userId ile bulunuyor; istemcinin gönderdiği profil kimliğiyle değil.
  const profile = await Profile.findOne({ where: { userId } });
  if (!profile) {
    throw ApiError.notFound('Profil bulunamadı. Önce profil oluşturun.');
  }

  await profile.update(data);
  logger.info('Profil güncellendi.', { userId });

  return profile;
}

// Yalnızca profil kaydını siler, kullanıcı hesabı etkilenmez.
async function deleteProfile(userId) {
  const profile = await Profile.findOne({ where: { userId } });
  if (!profile) {
    throw ApiError.notFound('Silinecek profil bulunamadı.');
  }

  // Bulut kimliği kayıt silinmeden önce okunuyor; sonrasında ulaşmanın yolu yok.
  const publicId = profile.photoPublicId;

  await profile.destroy();
  // Depo temizliği en sonda. Ters sırada dosya silinip kayıt silinemeseydi
  // profil var olmayan bir fotoğrafı göstermeye devam ederdi; bu sırada en
  // kötü ihtimalle depoda artık bir dosya kalıyor.
  await storage.deleteImage(publicId);

  logger.info('Profil silindi.', { userId });
}

async function updatePhoto(userId, buffer) {
  const profile = await Profile.findOne({ where: { userId } });
  if (!profile) {
    throw ApiError.notFound('Önce profilinizi oluşturun.');
  }

  const eskiPublicId = profile.photoPublicId;

  // Sıra önemli: eski dosya en sonda siliniyor. Başta silinip yükleme
  // başarısız olsaydı kullanıcı her iki fotoğrafından da olurdu.
  const { url, publicId } = await storage.saveImage(buffer, `user-${userId}`);
  await profile.update({ photoUrl: url, photoPublicId: publicId });
  await storage.deleteImage(eskiPublicId);

  logger.info('Profil fotoğrafı güncellendi.', { userId });
  return profile;
}

async function removePhoto(userId) {
  const profile = await Profile.findOne({ where: { userId } });
  if (!profile) {
    throw ApiError.notFound('Profil bulunamadı.');
  }
  if (!profile.photoUrl) {
    throw ApiError.conflict('Kaldırılacak bir fotoğraf yok.');
  }

  const publicId = profile.photoPublicId;
  await profile.update({ photoUrl: null, photoPublicId: null });
  await storage.deleteImage(publicId);

  logger.info('Profil fotoğrafı kaldırıldı.', { userId });
  return profile;
}

/**
 * Hesap silme akışı için: buluttaki dosyanın kimliğini verir.
 *
 * users kaydı silindiğinde profil satırı ON DELETE CASCADE ile düşüyor, ama
 * veritabanı kuralı Cloudinary'deki dosyaya dokunmuyor. Kimliğin silme
 * işleminden ÖNCE okunması gerektiği için okuma ve silme iki ayrı adım.
 *
 * @returns {Promise<string|null>}
 */
async function getPhotoPublicId(userId) {
  const profile = await Profile.findOne({
    where: { userId },
    attributes: ['photoPublicId'],
  });
  return profile?.photoPublicId ?? null;
}

/**
 * Depodan dosya siler. Doğrudan storage.service çağırmak yerine buradan:
 * hangi sağlayıcının kullanıldığı çağıranları ilgilendirmiyor.
 */
async function deleteStoredPhoto(publicId) {
  await storage.deleteImage(publicId);
}

// Tamamlama oranına sayılan alanlar. id ve tarih sütunları yok: kullanıcının
// dolduramayacağı alanlar oranı anlamsız kılar.
const COMPLETION_FIELDS = [
  'firstName', 'lastName', 'phone', 'birthDate',
  'city', 'district', 'address', 'bio',
];

/**
 * Profil tamamlama oranı. Aynı bilgi hem panelde hem profil sayfasında
 * gerektiği için sunucuda hesaplanıyor.
 *
 * @param {object|null} profile
 * @returns {{percent: number, filled: number, total: number, missing: string[]}}
 */
function calculateCompletion(profile) {
  const total = COMPLETION_FIELDS.length;

  if (!profile) {
    return { percent: 0, filled: 0, total, missing: [...COMPLETION_FIELDS] };
  }

  // Boş dize de "doldurulmamış" sayılıyor; eski kayıtlarda null yerine bulunabilir.
  const missing = COMPLETION_FIELDS.filter((alan) => {
    const deger = profile[alan];
    return deger === null || deger === undefined || String(deger).trim() === '';
  });

  const filled = total - missing.length;

  return {
    percent: Math.round((filled / total) * 100),
    filled,
    total,
    missing,
  };
}

module.exports = {
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  updatePhoto,
  removePhoto,
  getPhotoPublicId,
  deleteStoredPhoto,
  calculateCompletion,
  COMPLETION_FIELDS,
};
