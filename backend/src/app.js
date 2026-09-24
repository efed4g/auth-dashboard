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
 * Express uygulaması ve middleware zinciri. Sıralama bağımlılığa göre:
 * güvenlik başlıkları → log → CORS → gövde/cookie → CSRF → rotalar → hata.
 * CSRF, cookieParser'dan önce çalışsaydı req.cookies boş olur ve her istek
 * reddedilirdi. Portu dinlemeye başlatma işi burada değil (bkz. index.js).
 */
const app = express();

// Proxy arkasında req.ip proxy'nin IP'sini gösterir; rate limit o durumda
// bütün kullanıcıları tek IP sanıp kilitler.
if (env.trustProxy) {
  app.set('trust proxy', env.trustProxy);
}

app.disable('x-powered-by');

// contentSecurityPolicy kapalı: bu uygulama JSON döndürüyor, CSP frontend'i
// sunan katmanın işi. crossOriginResourcePolicy 'cross-origin' çünkü varsayılan
// 'same-origin' farklı porttaki frontend'i engellerdi.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(requestLogger);

// Cookie tabanlı oturumda CORS tek başına yetmiyor: sunucuda credentials: true,
// istemcide fetch'in credentials: 'include' seçeneği birlikte gerekiyor.
const allowedOrigins = env.frontendUrls;
app.use(cors({
  origin(origin, callback) {
    // Origin başlığı olmayan istekler tarayıcıdan gelmiyor (curl, sağlık kontrolü).
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Hata vermek yerine izin başlıkları atlanıyor: sonuç aynı ama her deneme
    // 500 + stack trace olarak loglanmıyor.
    logger.warn('CORS: izin verilmeyen origin reddedildi.', { origin });
    return callback(null, false);
  },
  credentials: true,
}));

// En büyük gövde bir Firebase ID token'ı; sınırsız bırakmak bellek şişirmeye
// açık kapı bırakırdı.
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// CSRF tek noktadan tüm /api altına: ileride eklenecek bir uç korumasız kalmasın.
app.use('/api', verifyCsrf);
app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
