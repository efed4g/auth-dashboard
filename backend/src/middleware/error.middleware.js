const { ValidationError, UniqueConstraintError, DatabaseError } = require('sequelize');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');
const env = require('../config/env');

function notFoundHandler(req, res, next) {
  next(ApiError.notFound('Kaynak bulunamadı.'));
}

/**
 * Tek merkezden hata yönetimi.
 * Beklenmeyen hatalarda istemciye ayrıntı gitmez, stack yalnızca logda kalır.
 */
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = 500;
  let message = 'Beklenmeyen bir sunucu hatası oluştu.';
  let code;

  if (err instanceof ApiError) {
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
    ...(isServerError && !env.isProduction ? { detail: err.message } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
