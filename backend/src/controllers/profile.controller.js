/**
 * Profil uçlarının HTTP katmanı: doğrula, servisi çağır, cevabı yaz.
 * Kullanıcı kimliği her yerde req.user.id — requireAuth'un imzalı access
 * token'dan çözdüğü değer. İstemci gövdeye ne yazarsa yazsın etkilemez.
 */
const profileService = require('../services/profile.service');
const { assertValidProfile } = require('../utils/profileValidation');
const { getCities } = require('../data/locations');
const ApiError = require('../utils/apiError');

// GET /api/profile/locations — aynı liste doğrulamada da kullanıldığı için
// frontend'e gömülmüyor, tek kaynak burası.
async function getLocations(req, res) {
  res.json({ cities: getCities() });
}

/**
 * GET /api/profile
 *
 * Profil yoksa 404 değil 200 + null: arayüz bu cevaba bakıp oluşturma mı
 * düzenleme mi formu göstereceğine karar veriyor.
 */
async function getMyProfile(req, res) {
  const profile = await profileService.getProfile(req.user.id);

  res.json({
    profile: profile ? profile.toPublicJSON() : null,
    completion: profileService.calculateCompletion(profile),
  });
}

// POST /api/profile
async function createMyProfile(req, res) {
  // Doğrulama beklenen alanları da süzüyor: gövdeye eklenmiş userId/role geçemez.
  const data = assertValidProfile(req.body);
  const profile = await profileService.createProfile(req.user.id, data);

  res.status(201).json({
    message: 'Profiliniz oluşturuldu.',
    profile: profile.toPublicJSON(),
  });
}

// PUT /api/profile
async function updateMyProfile(req, res) {
  const data = assertValidProfile(req.body);
  const profile = await profileService.updateProfile(req.user.id, data);

  res.json({
    message: 'Profiliniz güncellendi.',
    profile: profile.toPublicJSON(),
  });
}

// DELETE /api/profile
async function deleteMyProfile(req, res) {
  await profileService.deleteProfile(req.user.id);

  res.json({ message: 'Profiliniz silindi.' });
}

// POST /api/profile/photo — tür ve boyut denetimi upload middleware'inde yapıldı,
// burada yalnızca dosyanın geldiği kontrol ediliyor.
async function uploadMyPhoto(req, res) {
  if (!req.file) {
    throw ApiError.badRequest('Bir dosya seçmelisiniz.', {
      fields: { photo: 'Dosya bulunamadı.' },
    });
  }

  const profile = await profileService.updatePhoto(req.user.id, req.file.buffer);

  res.json({
    message: 'Profil fotoğrafınız güncellendi.',
    profile: profile.toPublicJSON(),
    completion: profileService.calculateCompletion(profile),
  });
}

// DELETE /api/profile/photo
async function deleteMyPhoto(req, res) {
  const profile = await profileService.removePhoto(req.user.id);

  res.json({
    message: 'Profil fotoğrafınız kaldırıldı.',
    profile: profile.toPublicJSON(),
    completion: profileService.calculateCompletion(profile),
  });
}

module.exports = {
  getLocations,
  uploadMyPhoto,
  deleteMyPhoto,
  getMyProfile,
  createMyProfile,
  updateMyProfile,
  deleteMyProfile,
};
