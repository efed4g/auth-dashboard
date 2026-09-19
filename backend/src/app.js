const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const logger = require('./utils/logger');
const routes = require('./routes');
const requestLogger = require('./middleware/requestLogger.middleware');
const { verifyCsrf } = require('./middleware/csrf.middleware');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

/**
 * Express uygulaması ve middleware zinciri.
 *
 * Buradaki sıralama rastgele değil, her katman kendinden öncekine dayanıyor:
 * güvenlik başlıkları -> log -> CORS -> gövde/cookie ayrıştırma -> CSRF ->
 * rotalar -> hata yakalama. Örneğin CSRF kontrolü cookieParser'dan önce
 * çalışsaydı req.cookies henüz dolu olmayacağı için her istek reddedilirdi.
 *
 * Sunucuyu dinlemeye başlatma işi bilerek burada değil (bkz. index.js).
 */
const app = express();

// express-rate-limit ve req.ip, proxy arkasında gerçek istemci yerine proxy'nin
// IP'sini görür; o durumda tek bir IP'ye uygulanan limit bütün kullanıcıları
// kilitler. TRUST_PROXY verilmişse X-Forwarded-For başlığına güveniyoruz.
if (env.trustProxy) {
  app.set('trust proxy', env.trustProxy);
}

// Sunucu yazılımı ve sürümünü sızdıran varsayılan başlık kapatılıyor.
app.disable('x-powered-by');

// helmet: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy gibi
// başlıkları tek yerden ayarlar.
//   contentSecurityPolicy  -> kapalı, çünkü bu uygulama HTML değil yalnızca JSON
//                             döndürüyor; CSP frontend'i sunan katmanın işi.
//   crossOriginResourcePolicy -> 'cross-origin', varsayılan 'same-origin' değeri
//                             farklı porttaki frontend'in isteklerini engellerdi.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(requestLogger);

// Cookie tabanlı oturumda CORS ayarı tek başına yetmiyor: sunucuda
// credentials: true, istemcide fetch'in credentials: 'include' seçeneği
// birlikte olmadan tarayıcı cookie'yi ne gönderir ne de yazar.
const allowedOrigins = env.frontendUrls;
app.use(cors({
  origin(origin, callback) {
    // Origin başlığı olmayan istekler tarayıcıdan gelmiyordur (curl, sunucudan
    // sunucuya çağrı, sağlık kontrolü). Bunlarda CORS'un koruduğu bir şey yok.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // callback'e hata vermek yerine yalnızca izin başlıklarını atlıyoruz.
    // Sonuç aynı (tarayıcı isteği engeller) ama her deneme 500 + stack trace
    // olarak loglanmıyor; izinsiz origin taramaları log'u kirletmesin.
    logger.warn('CORS: izin verilmeyen origin reddedildi.', { origin });
    return callback(null, false);
  },
  credentials: true,
}));

// 10kb sınırı: bu API'ye gelen en büyük gövde bir Firebase ID token'ı.
// Sınırsız bırakmak, büyük JSON gönderilerek belleğin şişirilmesine açık kapı.
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// CSRF kontrolü rotalardan önce ve tüm /api altına uygulanıyor. Rota rota
// eklemek yerine tek noktadan geçirmek, ileride eklenecek bir ucun korumasız
// kalma ihtimalini ortadan kaldırıyor (güvenlik varsayılanı kapalı değil açık).
app.use('/api', verifyCsrf);
app.use('/api', routes);

// Hiçbir rotaya düşmeyen istekler ve fırlatılan hatalar zincirin sonunda
// toplanıyor; cevabın biçimini tek bir yer belirlesin diye.
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
