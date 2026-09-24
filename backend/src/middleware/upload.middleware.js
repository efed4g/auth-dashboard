/**
 * Fotoğraf yükleme middleware'i: boyut sınırı, tür kontrolü, bellek depolama.
 *
 * mimetype istemciden gelir ve taklit edilebilir; asıl güvence dosyanın
 * Cloudinary'ye resim olarak gönderilmesi, resim olmayan içerik orada reddediliyor.
 */
const multer = require('multer');
const ApiError = require('../utils/apiError');

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
  // Dosya req.file.buffer içinde gelir, diske hiç yazılmaz.
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_BYTES,
    files: 1,
  },
  fileFilter(req, file, cb) {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(ApiError.badRequest(
        'Yalnızca JPEG, PNG veya WEBP yükleyebilirsiniz.',
        { fields: { photo: 'Desteklenmeyen dosya türü.' } }
      ));
    }
    return cb(null, true);
  },
});

/**
 * Tek dosyalık yükleme, alan adı "photo".
 * multer'ın kendi hataları ApiError'a çevriliyor; aksi halde kullanıcı
 * "File too large" gibi bağlamsız bir mesaj görürdü.
 */
function uploadPhoto(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(ApiError.badRequest(
          `Dosya çok büyük. En fazla ${MAX_BYTES / 1024 / 1024} MB yükleyebilirsiniz.`,
          { fields: { photo: 'Dosya boyutu sınırı aşıldı.' } }
        ));
      }
      return next(ApiError.badRequest('Dosya yüklenemedi.', {
        fields: { photo: err.message },
      }));
    }

    // fileFilter'dan gelen ApiError ya da beklenmeyen hata.
    return next(err);
  });
}

module.exports = { uploadPhoto, MAX_BYTES, ALLOWED_TYPES };
