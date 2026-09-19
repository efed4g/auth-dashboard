/**
 * Girdi doğrulama kuralları.
 *
 * Doğrulama controller'ların içine dağıtılmadı: aynı kuralın kayıt, giriş ve
 * şifre sıfırlamada farklı yazılması, aradan sızan bir durum yaratıyor.
 * Fonksiyonlar "assert" mantığıyla çalışıyor; kural sağlanmazsa ApiError
 * fırlatıp normalize edilmiş değeri döndürüyorlar, böylece çağıran taraf
 * hem kontrolü hem dönüşümü tek satırda hallediyor.
 *
 * Frontend'de de aynı kontroller var ama onlar yalnızca kullanıcıya hızlı
 * geri bildirim için; asıl doğrulama burası, çünkü istek doğrudan API'ye de
 * gönderilebilir.
 */
const ApiError = require('./apiError');

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
// RFC 5321'in adres için tanımladığı üst sınır.
const MAX_EMAIL_LENGTH = 254;

// E-posta için tam RFC uyumlu regex yazmak pratikte hem okunamaz hem de
// geçerli adresleri eleme riski taşıyor. Buradaki kalıp yazım hatalarını
// (boşluk, eksik @, eksik uzantı) yakalamaya yetiyor; adresin gerçekten var
// olduğunu zaten doğrulama e-postası kanıtlıyor.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Küçük harfe çevirme, "Ali@X.com" ile "ali@x.com" adreslerinin iki ayrı hesap
// açmasını engelliyor. Karşılaştırma ve kayıt hep bu normalize hali üzerinden.
function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * E-posta + şifre çiftini doğrular.
 *
 * @param {object}  body                          İstek gövdesi
 * @param {boolean} [options.checkPasswordStrength=true]
 *        Girişte false geçiliyor: orada şifrenin politikaya uyup uymadığı
 *        değil, doğru olup olmadığı önemli. Aksi halde kurallar sıkılaştığında
 *        eski şifreli kullanıcılar giriş yapamaz hale gelirdi.
 * @returns {{email: string, password: string}} Normalize edilmiş değerler
 */
function assertValidCredentials({ email, password }, { checkPasswordStrength = true } = {}) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || typeof password !== 'string' || password.length === 0) {
    throw ApiError.badRequest('E-posta ve şifre zorunlu.');
  }
  if (normalizedEmail.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(normalizedEmail)) {
    throw ApiError.badRequest('Geçersiz e-posta adresi.');
  }
  if (checkPasswordStrength) {
    assertValidPassword(password);
  }

  return { email: normalizedEmail, password };
}

function assertValidPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw ApiError.badRequest(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
  }
  // Üst sınır iki sebepten var: bcrypt 72 bayttan sonrasını zaten yok sayıyor,
  // ayrıca çok uzun girdiyle hash'leme maliyeti artırılıp sunucu meşgul
  // edilebiliyor (hesaplama maliyetli bir işlem).
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw ApiError.badRequest(`Şifre en fazla ${MAX_PASSWORD_LENGTH} karakter olabilir.`);
  }
  return password;
}

// Şifre beklemeyen uçlar için (şifremi unuttum, Google'dan gelen adres).
function assertValidEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
    throw ApiError.badRequest('Geçersiz e-posta adresi.');
  }
  return normalizedEmail;
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  assertValidCredentials,
  assertValidPassword,
  assertValidEmail,
};
