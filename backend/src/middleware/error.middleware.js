const { ValidationError, UniqueConstraintError, DatabaseError } = require('sequelize');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');
const env = require('../config/env');

// Zincirin sonuna kadar gelen istek hiçbir rotaya uymamıştır. Express'in
// varsayılan HTML hata sayfası yerine, diğer uçlarla aynı JSON biçimini
// dönmesi için hatayı errorHandler'a yönlendiriyoruz.
function notFoundHandler(req, res, next) {
  next(ApiError.notFound('Kaynak bulunamadı.'));
}

/**
 * Merkezi hata yakalayıcı. (Express hata middleware'i olarak tanınması için
 * dört parametreli imza zorunlu; `next` kullanılmasa da kaldırılamaz.)
 *
 * Buradaki temel kural: istemciye yalnızca anlamlı ve güvenli bilgi gitsin.
 * Beklenmeyen hataların mesajı veritabanı yapısını ya da dosya yollarını ele
 * verebileceği için dışarıya genel bir metin dönüyor; ayrıntı ve stack trace
 * yalnızca sunucu logunda kalıyor.
 */
function errorHandler(err, req, res, next) {
  // Cevap yazılmaya başlandıysa artık durum kodu değiştirilemez; bu durumda
  // Express'in yerleşik yakalayıcısına devredip bağlantıyı ona kapattırıyoruz.
  if (res.headersSent) {
    return next(err);
  }

  // Varsayılan olarak 500 kabul ediliyor; tanıyabildiğimiz hata türleri
  // aşağıda daha anlamlı bir koda çekiliyor.
  let statusCode = 500;
  let message = 'Beklenmeyen bir sunucu hatası oluştu.';
  let code;

  if (err instanceof ApiError) {
    // Kendi fırlattığımız hatalar: mesajı zaten kullanıcıya gösterilmek üzere yazıldı.
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
  } else if (err instanceof UniqueConstraintError) {
    // Örn. aynı e-posta ile ikinci kayıt. Kullanıcı hatası olduğu için 409.
    statusCode = 409;
    message = 'Bu kayıt zaten mevcut.';
  } else if (err instanceof ValidationError) {
    // Model seviyesindeki kurallar (isEmail, isIn...) burada yakalanıyor.
    statusCode = 400;
    message = 'Gönderilen veriler geçersiz.';
  } else if (err.type === 'entity.parse.failed') {
    // express.json() bozuk gövdeyi ayrıştıramadı. Sunucu değil istemci hatası.
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
    // Yalnızca gerçek sunucu hataları error seviyesinde loglanıyor. Hatalı
    // şifre gibi beklenen durumlar da error olsaydı log'da gürültü yaratıp
    // asıl sorunları görünmez kılardı.
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
    // Ayrıntı yalnızca development'ta ekleniyor: hata ayıklarken sunucu
    // loguna bakmak zorunda kalmamak için. Production'da bu alan hiç yok.
    ...(isServerError && !env.isProduction ? { detail: err.message } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
