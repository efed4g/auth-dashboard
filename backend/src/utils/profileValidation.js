/**
 * Profil verisi doğrulaması.
 *
 * Kimlik doğrulama kurallarından (validation.js) ayrı tutuldu. İlk hatada
 * durmuyor: tüm alanlar kontrol edilip hatalar tek seferde toplanıyor, böylece
 * kullanıcı formu tekrar tekrar göndermek zorunda kalmıyor.
 */
const ApiError = require('./apiError');
const { isValidCity, isValidDistrict } = require('../data/locations');

// Sınırlar veritabanı sütun uzunluklarıyla aynı. Burada da kontrol ediliyor ki
// kullanıcı teknik bir veritabanı hatası yerine anlamlı bir mesaj görsün.
const LIMITS = {
  firstName: { min: 2, max: 60 },
  lastName: { min: 2, max: 60 },
  city: { max: 60 },
  district: { max: 60 },
  address: { max: 255 },
  bio: { max: 500 },
  phone: { minDigits: 10, maxDigits: 15 },
};

// Biçim ülkeden ülkeye değiştiği için katı desen yok: bu karakterler serbest,
// asıl kontrol temizlendikten sonra kalan rakam sayısına bakılarak yapılıyor.
const PHONE_ALLOWED = /^[\d\s()+-]+$/;

// Bundan eski tarihler büyük ihtimalle yazım hatası.
const MIN_BIRTH_YEAR = 1900;

function temizle(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Boş bırakılan isteğe bağlı alanlar null olarak yazılsın; boş dize
// "değer var ama boş" gibi yanıltıcı olurdu.
function bosIseNull(value) {
  const temiz = temizle(value);
  return temiz.length > 0 ? temiz : null;
}

/**
 * Profil gövdesini doğrular ve yazılmaya hazır nesne döndürür.
 *
 * @param {object} body İstek gövdesi (req.body)
 * @returns {object} Temizlenmiş veri
 * @throws {ApiError} 400 ve fields nesnesiyle
 */
function assertValidProfile(body = {}) {
  const errors = {};

  // Ad ve soyad: zorunlu
  const firstName = temizle(body.firstName);
  if (firstName.length < LIMITS.firstName.min) {
    errors.firstName = `Ad en az ${LIMITS.firstName.min} karakter olmalı.`;
  } else if (firstName.length > LIMITS.firstName.max) {
    errors.firstName = `Ad en fazla ${LIMITS.firstName.max} karakter olabilir.`;
  }

  const lastName = temizle(body.lastName);
  if (lastName.length < LIMITS.lastName.min) {
    errors.lastName = `Soyad en az ${LIMITS.lastName.min} karakter olmalı.`;
  } else if (lastName.length > LIMITS.lastName.max) {
    errors.lastName = `Soyad en fazla ${LIMITS.lastName.max} karakter olabilir.`;
  }

  // Telefon: isteğe bağlı, doldurulduysa biçimi tutmalı
  const phone = bosIseNull(body.phone);
  if (phone !== null) {
    if (!PHONE_ALLOWED.test(phone)) {
      errors.phone = 'Telefon yalnızca rakam, boşluk ve + ( ) - içerebilir.';
    } else {
      const rakamlar = phone.replace(/\D/g, '');
      if (rakamlar.length < LIMITS.phone.minDigits || rakamlar.length > LIMITS.phone.maxDigits) {
        errors.phone = `Telefon ${LIMITS.phone.minDigits}-${LIMITS.phone.maxDigits} rakam içermeli.`;
      }
    }
  }

  // Doğum tarihi: isteğe bağlı, gelecekte olamaz
  const birthDateRaw = bosIseNull(body.birthDate);
  let birthDate = null;
  if (birthDateRaw !== null) {
    // <input type="date"> YYYY-MM-DD gönderiyor.
    const tarih = new Date(`${birthDateRaw}T00:00:00Z`);
    if (Number.isNaN(tarih.getTime())) {
      errors.birthDate = 'Doğum tarihi geçersiz.';
    } else if (tarih.getTime() > Date.now()) {
      errors.birthDate = 'Doğum tarihi gelecekte olamaz.';
    } else if (tarih.getUTCFullYear() < MIN_BIRTH_YEAR) {
      errors.birthDate = `Doğum tarihi ${MIN_BIRTH_YEAR} yılından eski olamaz.`;
    } else {
      birthDate = birthDateRaw;
    }
  }

  // Şehir ve ilçe: arayüz açılır liste kullanıyor ama istek elle de
  // gönderilebilir; asıl kontrol burada.
  const city = bosIseNull(body.city);
  if (city && !isValidCity(city)) {
    errors.city = 'Geçerli bir şehir seçin.';
  }

  const district = bosIseNull(body.district);
  if (district) {
    if (!city) {
      // "Çankaya" tek başına hangi şehrin ilçesi belli olmaz.
      errors.district = 'İlçe seçmek için önce şehir seçmelisiniz.';
    } else if (!errors.city && !isValidDistrict(city, district)) {
      // Şehir zaten hatalıysa ikinci hata gösterilmiyor; önce şehir düzeltilsin.
      errors.district = 'Seçilen ilçe bu şehre ait değil.';
    }
  }

  const address = bosIseNull(body.address);
  if (address && address.length > LIMITS.address.max) {
    errors.address = `Adres en fazla ${LIMITS.address.max} karakter olabilir.`;
  }

  const bio = bosIseNull(body.bio);
  if (bio && bio.length > LIMITS.bio.max) {
    errors.bio = `Hakkımda en fazla ${LIMITS.bio.max} karakter olabilir.`;
  }

  // Tek hata bile varsa hiçbir şey kaydedilmiyor.
  if (Object.keys(errors).length > 0) {
    throw ApiError.badRequest('Gönderilen veriler geçersiz.', { fields: errors });
  }

  // Yalnızca beklenen alanlar dönüyor: gövdeye eklenmiş userId/role geçemez.
  return { firstName, lastName, phone, birthDate, city, district, address, bio };
}

module.exports = { assertValidProfile, LIMITS };
