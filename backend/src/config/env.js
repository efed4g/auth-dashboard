/**
 * Ortam değişkenlerinin tek giriş kapısı.
 *
 * Kodun hiçbir yerinde doğrudan process.env okunmuyor; herkes bu modülden
 * geçiyor. Bunun iki faydası var: (1) hangi değişkenin nerede kullanıldığı tek
 * dosyadan görülüyor, (2) eksik ya da tutarsız yapılandırma sunucu daha ilk
 * require sırasında patlayarak fark ediliyor. Yarı yapılandırılmış bir sunucunun
 * çalışmaya devam edip ilk giriş denemesinde hata vermesi çok daha kötü.
 */
const path = require('path');
const dotenv = require('dotenv');

// Hangi .env dosyasının okunacağını NODE_ENV belirliyor. Dosya adı sabit değil
// ki aynı kod tabanı dev ve production'da farklı değerlerle çalışabilsin.
const NODE_ENV = process.env.NODE_ENV || 'development';
const envFileName = NODE_ENV === 'production' ? '.env.production' : '.env.development';
const envFilePath = path.resolve(__dirname, '..', '..', envFileName);

// dotenv zaten tanımlı olan değişkenlerin üzerine yazmaz. Docker/CI gibi
// ortamlarda değerler dışarıdan enjekte edildiğinde dosya olmasa da sorun çıkmaz.
dotenv.config({ path: envFilePath });

const isProduction = NODE_ENV === 'production';

// Bunlar olmadan uygulama anlamlı çalışamaz; makul bir varsayılanları da yok.
// PORT de listede: kodda sabit port bırakmamak için bilerek zorunlu tutuldu.
const REQUIRED_KEYS = [
  'PORT',
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'FRONTEND_URL',
  'BACKEND_URL',
];

// Hata mesajı hangi değişkenin eksik olduğunu ve hangi dosyaya bakılacağını
// yazıyor; projeyi ilk kez kuran biri tahmin yürütmek zorunda kalmasın.
const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Eksik ortam değişkeni: ${missing.join(', ')}. ` +
    `Beklenen dosya: ${envFilePath} (örnek için .env.example)`
  );
}

// Access ve refresh token'lar ayrı anahtarlarla imzalanıyor. Aynı anahtar
// kullanılsaydı access token imza doğrulamasını geçtiği için refresh ucuna
// sunulabilirdi; bunu kodla engellemek yerine yapılandırma düzeyinde kesiyoruz.
if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET ve JWT_REFRESH_SECRET aynı olamaz.');
}

// Firebase zorunlu listede değil: değerler yoksa sunucu normal çalışır, sadece
// Google ile giriş kapanır. Projeyi inceleyen birinin Firebase hesabı açmadan
// da e-posta/şifre akışını deneyebilmesi için bu esneklik bilerek bırakıldı.
const firebaseKeys = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
const firebaseEnabled = firebaseKeys.every((key) => Boolean(process.env[key]));

// Adresleri `${url}/api/...` biçiminde birleştirdiğimiz için sondaki eğik çizgi
// çift slash'a yol açıyor. Değeri girişte normalize etmek, her birleştirme
// noktasında ayrı ayrı kontrol yazmaktan daha güvenli.
function normalizeUrl(value) {
  return value.trim().replace(/\/+$/, '');
}

/**
 * FRONTEND_URL iki farklı işi görüyor ve bu ikisi karıştırılmamalı:
 *  - CORS izin listesi: birden fazla origin olabilir (virgülle ayrılır).
 *  - Link üretimi: doğrulama ve şifre sıfırlama bağlantıları için tek adres.
 *
 * Değer bölünmeden kullanıldığında "http://a,http://b/login" gibi bozuk
 * bağlantılar üretiliyordu. Bu yüzden liste ve kanonik adres ayrı ayrı
 * dışa aktarılıyor; listenin ilk elemanı kanonik kabul ediliyor.
 */
const frontendUrls = process.env.FRONTEND_URL.split(',').map(normalizeUrl).filter(Boolean);

// Değişken tanımlı ama sadece virgül/boşluk içeriyorsa yukarıdaki zorunluluk
// kontrolü bunu yakalayamaz; boş listeyle devam etmek yerine burada duruyoruz.
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
  // CORS izin listesi için tamamı, bağlantı üretimi için ilki.
  frontendUrls,
  frontendUrl: frontendUrls[0],
  backendUrl: normalizeUrl(process.env.BACKEND_URL),
  // Production'da genelde bir reverse proxy bulunur, bu yüzden varsayılan açık.
  trustProxy: process.env.TRUST_PROXY || (isProduction ? '1' : false),

  jwt: {
    accessSecret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    // Access token kısa ömürlü: çalınırsa zarar penceresi dar olsun.
    // Refresh uzun ömürlü ki kullanıcı her 15 dakikada yeniden giriş yapmasın.
    accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshTtl: process.env.REFRESH_TOKEN_TTL || '7d',
  },

  cookie: {
    // secure bayrağı ortamdan türetiliyor: localhost HTTPS olmadığı için
    // development'ta true olsaydı tarayıcı cookie'yi hiç yazmazdı.
    secure: isProduction,
    // sameSite deploy topolojisine bağlı, tek doğru değeri yok:
    // frontend ve backend aynı sitedeyse lax/strict yeterli, farklı
    // domainlerdeyse cookie'nin gidebilmesi için none şart.
    sameSite: process.env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax'),
    // Alt alan adları arasında paylaşım gerekmedikçe boş bırakılıyor; tanımlamak
    // cookie'yi bütün alt alan adlarına açtığı için gereksiz yüzey yaratır.
    domain: process.env.COOKIE_DOMAIN || undefined,
  },

  firebase: {
    enabled: firebaseEnabled,
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Servis hesabı anahtarı çok satırlı bir PEM. .env dosyasında tek satıra
    // sığsın diye satır sonları "\n" olarak yazılıyor; burada gerçek satır
    // sonuna çevrilmezse Firebase Admin SDK anahtarı ayrıştıramıyor.
    privateKey: process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined,
  },
};
