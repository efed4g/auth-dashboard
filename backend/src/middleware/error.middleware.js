const { ValidationError, UniqueConstraintError, DatabaseError } = require('sequelize');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');
const env = require('../config/env');

// Hiçbir rotaya uymayan istek. Express'in HTML hata sayfası yerine diğer
// uçlarla aynı JSON biçimini dönmesi için errorHandler'a yönlendiriliyor.
function notFoundHandler(req, res, next) {
  next(ApiError.notFound('Kaynak bulunamadı.'));
}

/**
 * Merkezi hata yakalayıcı. Dört parametreli imza zorunlu; `next` kullanılmasa
 * da kaldırılamaz, yoksa Express bunu hata middleware'i saymaz.
 *
 * Kural: beklenmeyen hataların mesajı veritabanı yapısını veya dosya yollarını
 * ele verebilir, bu yüzden dışarı genel metin gider; ayrıntı logda kalır.
 */
function errorHandler(err, req, res, next) {
  // Cevap yazılmaya başlandıysa durum kodu değiştirilemez.
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = 500;
  let message = 'Beklenmeyen bir sunucu hatası oluştu.';
  let code;

  if (err instanceof ApiError) {
    // Mesajı zaten kullanıcıya gösterilmek üzere yazıldı.
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
  } else if (err instanceof UniqueConstraintError) {
    statusCode = 409;
    message = 'Bu kayıt zaten mevcut.';
  } else if (err instanceof ValidationError) {
    statusCode = 400;
    message = 'Gönderilen veriler geçersiz.';
  } else if (err.type === 'entity.parse.failed') {
    // express.json() bozuk gövdeyi ayrıştıramadı: istemci hatası.
    statusCode = 400;
    message = 'Geçersiz JSON gövdesi.';
  }

  const isServerError = statusCode >= 500;
  const context = {
    method: req.method,
    path: req.path,
    statusCode,
    userId: req.user?.id,
  };

  if (isServerError) {
    // Hatalı şifre gibi beklenen durumlar error seviyesinde loglansaydı gerçek
    // sorunlar gürültüde kaybolurdu.
    logger.error(err.message || 'Sunucu hatası', {
      ...context,
      stack: err.stack,
      ...(err instanceof DatabaseError ? { db: true } : {}),
    });
  } else {
    logger.debug('İstek reddedildi', { ...context, reason: message });
  }

  return res.status(statusCode).json({
    error: message,
    ...(code ? { code } : {}),
    ...(err.fields ? { fields: err.fields } : {}),
    // Ayrıntı yalnızca development'ta; production'da bu alan hiç yok.
    ...(isServerError && !env.isProduction ? { detail: err.message } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
