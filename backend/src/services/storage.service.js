/**
 * Dosya depolama katmanı. Uygulamanın geri kalanı dosyanın nerede durduğunu
 * bilmiyor, yalnızca "kaydet" ve "sil" diyor; S3'e veya diske geçilirse
 * değişecek tek yer burası.
 */
const { v2: cloudinary } = require('cloudinary');
const env = require('../config/env');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

// Yapılandırma eksikse uygulama yine çalışır, yalnızca fotoğraf yükleme kapanır:
// projeyi inceleyen biri her dış servise hesap açmadan deneyebilsin.
const isEnabled = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);

if (isEnabled) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
} else {
  console.warn('[storage] CLOUDINARY_* değişkenleri eksik — fotoğraf yükleme devre dışı.');
}

// Aynı hesapta başka projeler varsa karışmasın diye klasör adı verildi.
const FOLDER = 'auth-dashboard/profile-photos';

function assertEnabled() {
  if (!isEnabled) {
    throw ApiError.serviceUnavailable('Fotoğraf yükleme bu ortamda yapılandırılmamış.');
  }
}

/**
 * Bellekteki dosyayı depoya yükler. multer dosyayı belleğe aldığı için
 * elimizde Buffer var; Cloudinary'nin stream API'si bunu doğrudan kabul
 * ediyor, geçici dosya yazmaya gerek kalmıyor.
 *
 * @param {Buffer} buffer Dosya içeriği
 * @param {string} keyPrefix Dosya adının başına eklenecek ayırt edici değer
 * @returns {Promise<{url: string, publicId: string}>}
 */
function saveImage(buffer, keyPrefix) {
  assertEnabled();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: FOLDER,
        public_id: `${keyPrefix}-${Date.now()}`,
        resource_type: 'image',
        // Sunucu tarafında boyutlandırma: 4000px'lik bir fotoğraf yüklense
        // bile depoda ve sayfada 512px duruyor.
        transformation: [
          { width: 512, height: 512, crop: 'fill', gravity: 'face' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          logger.error('Fotoğraf yüklenemedi.', { message: error.message });
          return reject(ApiError.badRequest('Fotoğraf yüklenemedi, lütfen tekrar deneyin.'));
        }
        return resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );

    stream.end(buffer);
  });
}

/**
 * Depodan dosya siler. Başarısız olursa yalnızca loglanıyor: kullanıcının asıl
 * işlemi bu yüzden başarısız sayılmamalı, geride kalan dosya en fazla yer kaplar.
 */
async function deleteImage(publicId) {
  if (!isEnabled || !publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    logger.warn('Eski fotoğraf silinemedi.', { publicId, message: err.message });
  }
}

module.exports = { isEnabled: () => isEnabled, saveImage, deleteImage };
