/**
 * Girdi doğrulama kuralları.
 *
 * Fonksiyonlar "assert" mantığıyla çalışıyor: kural sağlanmazsa ApiError
 * fırlatıyor, sağlanırsa normalize edilmiş değeri döndürüyor.
 *
 * Frontend'deki aynı kontroller yalnızca hızlı geri bildirim için; istek
 * doğrudan API'ye de gönderilebildiği için asıl doğrulama burada.
 */
const ApiError = require('./apiError');

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
// RFC 5321'in adres için tanımladığı üst sınır.
const MAX_EMAIL_LENGTH = 254;

// Tam RFC uyumlu regex hem okunmaz hem geçerli adresleri eleme riski taşıyor.
// Bu kalıp yazım hatalarını yakalamaya yetiyor; adresin gerçekten var olduğunu
// doğrulama e-postası kanıtlıyor.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// "Ali@X.com" ile "ali@x.com" iki ayrı hesap açmasın diye karşılaştırma ve
// kayıt hep bu normalize hali üzerinden.
function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * E-posta + şifre çiftini doğrular.
 *
 * @param {object}  body İstek gövdesi
 * @param {boolean} [options.checkPasswordStrength=true]
 *        Girişte false: orada şifrenin politikaya uyması değil doğru olması
 *        önemli. Aksi halde kurallar sıkılaşınca eski kullanıcılar giremezdi.
 * @returns {{email: string, password: string}}
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
  // Üst sınır: bcrypt 72 bayttan sonrasını zaten yok sayıyor, ayrıca çok uzun
  // girdiyle hash maliyeti artırılıp sunucu meşgul edilebilir.
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
