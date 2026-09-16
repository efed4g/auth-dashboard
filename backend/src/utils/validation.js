const ApiError = require('./apiError');

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;

// TLD uzunluğunu sınırlamayan, pratikte yeterli kontrol.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

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
  // bcrypt 72 byte sonrasını yok sayar; aşırı uzun girdi de DoS yüzeyi.
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw ApiError.badRequest(`Şifre en fazla ${MAX_PASSWORD_LENGTH} karakter olabilir.`);
  }
  return password;
}

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
