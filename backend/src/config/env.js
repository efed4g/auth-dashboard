/**
 * Ortam değişkenlerinin tek giriş kapısı.
 *
 * Kodun hiçbir yerinde doğrudan process.env okunmuyor. Böylece hangi değişkenin
 * nerede kullanıldığı tek dosyadan görülüyor ve eksik yapılandırma sunucu daha
 * ilk require sırasında patlayarak fark ediliyor.
 */
const path = require('path');
const dotenv = require('dotenv');

const NODE_ENV = process.env.NODE_ENV || 'development';
const ENV_FILES = {
  development: '.env.development',
  test: '.env.test',
  production: '.env.production',
};
const envFileName = ENV_FILES[NODE_ENV] || ENV_FILES.development;
const envFilePath = path.resolve(__dirname, '..', '..', envFileName);

// dotenv tanımlı değişkenlerin üzerine yazmaz: Docker/CI'da değerler dışarıdan
// enjekte edildiğinde dosya olmasa da sorun çıkmıyor.
dotenv.config({ path: envFilePath });

const isProduction = NODE_ENV === 'production';

// PORT de listede: kodda sabit port bırakmamak için bilerek zorunlu.
const REQUIRED_KEYS = [
  'PORT',
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'FRONTEND_URL',
  'BACKEND_URL',
];

const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Eksik ortam değişkeni: ${missing.join(', ')}. ` +
    `Beklenen dosya: ${envFilePath} (örnek için .env.example)`
  );
}

// Aynı anahtar kullanılsaydı access token imza doğrulamasını geçip refresh
// ucuna sunulabilirdi; kodla değil yapılandırma düzeyinde kesiliyor.
if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET ve JWT_REFRESH_SECRET aynı olamaz.');
}

// Firebase zorunlu değil: yoksa sunucu çalışır, yalnızca Google girişi kapanır.
const firebaseKeys = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
const firebaseEnabled = firebaseKeys.every((key) => Boolean(process.env[key]));

// Adresler `${url}/api/...` biçiminde birleştirildiği için sondaki eğik çizgi
// çift slash'a yol açıyor.
function normalizeUrl(value) {
  return value.trim().replace(/\/+$/, '');
}

// FRONTEND_URL iki iş görüyor: CORS izin listesi (birden fazla olabilir) ve
// link üretimi (tek adres). Bölünmeden kullanıldığında "http://a,http://b/login"
// gibi bozuk bağlantılar üretiyordu; ikisi ayrı dışa aktarılıyor.
const frontendUrls = process.env.FRONTEND_URL.split(',').map(normalizeUrl).filter(Boolean);

// Değer tanımlı ama sadece virgül/boşluksa yukarıdaki kontrol yakalayamaz.
if (frontendUrls.length === 0) {
  throw new Error('FRONTEND_URL en az bir origin içermeli.');
}

module.exports = {
  nodeEnv: NODE_ENV,
  isProduction,
  envFilePath,
  port: Number(process.env.PORT),
  databaseUrl: process.env.DATABASE_URL,
  databaseLogging: process.env.DB_LOGGING === 'true',
  frontendUrls,
  frontendUrl: frontendUrls[0],
  backendUrl: normalizeUrl(process.env.BACKEND_URL),
  // Production'da genelde reverse proxy bulunur.
  trustProxy: process.env.TRUST_PROXY || (isProduction ? '1' : false),

  jwt: {
    accessSecret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    // Access kısa: çalınırsa zarar penceresi dar olsun. Refresh uzun: kullanıcı
    // her 15 dakikada yeniden giriş yapmasın.
    accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshTtl: process.env.REFRESH_TOKEN_TTL || '7d',
  },

  cookie: {
    // localhost HTTPS olmadığı için development'ta true olsaydı tarayıcı
    // cookie'yi hiç yazmazdı.
    secure: isProduction,
    // Deploy topolojisine bağlı: aynı sitede lax/strict yeterli, farklı
    // domainlerde cookie'nin gidebilmesi için none şart.
    sameSite: process.env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax'),
    domain: process.env.COOKIE_DOMAIN || undefined,
  },

  // Firebase gibi opsiyonel: yoksa fotoğraf yükleme kapanır.
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  firebase: {
    enabled: firebaseEnabled,
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Çok satırlı PEM, .env'de "\n" olarak yazılıyor; çevrilmezse Firebase
    // Admin SDK anahtarı ayrıştıramıyor.
    privateKey: process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined,
  },
};
