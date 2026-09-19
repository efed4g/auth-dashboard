# Auth Dashboard

Staj ödevi olarak hazırlanan, kimlik doğrulamalı dashboard uygulaması.

**Tamamlanan seviye: Seviye 3 (bonus dahil).** Ayrıntılar
[Tamamlanan seviyeler](#tamamlanan-seviyeler) bölümünde.

---

## İçindekiler

- [Proje amacı](#proje-amacı)
- [Kullanılan teknolojiler](#kullanılan-teknolojiler)
- [Proje mimarisi ve dizin yapısı](#proje-mimarisi-ve-dizin-yapısı)
- [Kurulum ve çalıştırma](#kurulum-ve-çalıştırma)
- [Ortam değişkenleri](#ortam-değişkenleri)
- [API dokümantasyonu](#api-dokümantasyonu)
- [Tamamlanan seviyeler](#tamamlanan-seviyeler)
- [Tasarım ve güvenlik kararları](#tasarım-ve-güvenlik-kararları)
- [Production secret yönetimi](#production-secret-yönetimi)
- [Bilinen sınırlar ve yapamadıklarım](#bilinen-sınırlar-ve-yapamadıklarım)

---

## Proje amacı

Kullanıcıların kayıt olabildiği, giriş yapabildiği ve giriş yapmadan
erişemediği bir dashboard sayfası bulunan tam bir web uygulaması. Ödevin asıl
konusu arayüz değil oturum yönetimi: token'ların nerede saklandığı, süresi
dolduğunda ne olduğu, çalındığında nasıl fark edildiği ve yetki kontrolünün
hangi katmanda yapıldığı.

Token'lar yalnızca httpOnly cookie ile taşınır; `localStorage` ve
`sessionStorage` hiçbir yerde kullanılmaz.

---

## Kullanılan teknolojiler

**Backend**

- **Express 5** — Ödevin şartı. Rota/controller/servis ayrımı el ile kuruldu.
- **PostgreSQL + Sequelize** — Ham SQL yerine ORM: sorgular parametreli
  çalıştığı için SQL injection yüzeyi kapanıyor, model tanımları da tek yerde
  toplanıyor.
- **sequelize-cli** — Tabloların migration ile oluşturulması ödev şartı.
  Şemanın nasıl geliştiği migration geçmişinden okunabiliyor.
- **jsonwebtoken** — Access ve refresh token'ların imzalanması.
- **bcrypt** — Şifre hash'leme. Maliyet katsayısı 12.
- **firebase-admin** — Google ile girişte gelen ID token'ın doğrulanması.
- **helmet** — Güvenlik başlıkları (HSTS, nosniff, frameguard, referrer-policy).
- **express-rate-limit** — Kimlik doğrulama uçlarında istek sınırlama.
- **morgan** — HTTP istek logu. Varsayılan formatı kullanılmadı; token ve şifre
  maskeleyen özel bir format tanımlandı.

**Frontend**

- **React 19 + Vite** — Vite tercih edildi: hem geliştirme sunucusu hızlı hem de
  `.env.<mode>` dosyalarını kendisi seçiyor, ortam ayrımı ek yapılandırma
  gerektirmiyor.
- **Redux Toolkit + RTK Query** — Sunucu verisi için ayrı bir katman. Her
  sayfada `useState`/`useEffect` ile yükleniyor-hata durumu yazmak yerine
  tek yerden yönetiliyor; CSRF başlığı ve otomatik oturum yenileme de
  `baseQuery` içinde çözülüyor.
- **React Router 7** — Rota bazlı erişim kontrolü (`ProtectedRoute`).
- **TailwindCSS 4** — Ödevin şartı.
- **firebase** — Google giriş penceresi.

**Diğer**

- **Yarn** — Paket yöneticisi.
- **Docker Compose** — Zorunlu değil; yalnızca PostgreSQL'i ayağa kaldırmak
  için de kullanılabiliyor.

---

## Proje mimarisi ve dizin yapısı

```
backend/
  index.js                      Sunucuyu başlatır: DB bağlantısı, listen, düzgün kapanma
  src/
    app.js                      Express uygulaması ve middleware sırası
    config/
      env.js                    NODE_ENV'e göre .env yükler, zorunlu değişkenleri doğrular
      database.js               Sequelize bağlantısı (tek örnek)
      config.js                 sequelize-cli'nin okuduğu yapılandırma
      firebase.js               Firebase Admin SDK sarmalayıcısı (opsiyonel)
    routes/
      index.js                  Alt rotaları toplar, /health
      auth.routes.js            /api/auth altındaki uçlar
      dashboard.routes.js       /api/dashboard ve /api/admin/users
    controllers/
      auth.controller.js        Kayıt, giriş, Google, şifre akışları
      dashboard.controller.js   Panel ve kullanıcı listesi
    services/
      session.service.js        Oturum yaşam döngüsü: kurma, rotasyon, iptal
      mailer.service.js         Doğrulama ve sıfırlama bağlantıları
    middleware/
      auth.middleware.js        requireAuth, requireRoles
      csrf.middleware.js        Double-submit cookie kontrolü
      rateLimit.middleware.js   Uç bazlı istek sınırlayıcılar
      requestLogger.middleware.js  morgan + maskeleme
      error.middleware.js       Merkezi hata yakalayıcı
    models/
      index.js                  Klasördeki modelleri otomatik yükler
      user.js · refreshToken.js
    utils/
      token.js                  Token üretimi, doğrulama, cookie yazımı
      validation.js             Girdi doğrulama kuralları
      apiError.js               Uygulamanın kendi hata tipi
      asyncHandler.js           Async controller'ları hata zincirine bağlar
      logger.js                 Maskeleme yapan yapılandırılmış logger
    migrations/ · seeders/

frontend/
  src/
    main.jsx                    Giriş noktası (Redux Provider)
    App.jsx                     Rota tanımları ve oturum bootstrap'ı
    app/
      store.js                  Redux store
      baseQuery.js              CSRF başlığı + otomatik token yenileme
    features/auth/
      authApi.js                Tüm API uçları (RTK Query)
      authSlice.js              Oturum durumu (token DEĞİL, sadece kullanıcı bilgisi)
    routes/                     ProtectedRoute · PublicOnlyRoute
    pages/                      Login · Register · ForgotPassword · ResetPassword ·
                                Dashboard · Security · Admin · NotFound
    components/                 GoogleButton · layout/ · ui/
    lib/                        firebase.js · errors.js
```

**Katman ayrımı neden böyle.** Uçları `index.js`'e yazmak küçük projede
çalışıyor ama dosya büyüdükçe okunamaz hale geliyor. Bu yapıda bir uç eklemek
tek bir rota satırı ve bir controller fonksiyonu demek. Oturumun teknik kurulumu
(token üretimi, veritabanı kaydı, cookie yazımı) servis katmanına alındı:
dağıtılsaydı bir yerde cookie yazılıp veritabanı kaydı atlanabilir ve oturum ilk
yenilemede "çalınmış" sanılabilirdi.

**Modeller neden otomatik yükleniyor.** `models/index.js` klasörü tarayıp her
dosyanın dışa aktardığı fabrika fonksiyonunu çağırıyor. Yeni bir model eklemek
için `src/models/<ad>.js` oluşturmak yeterli. İlişkiler ayrı bir turda
kuruluyor, böylece dosyaların yüklenme sırası önemsiz oluyor.

---

## Kurulum ve çalıştırma

### Gereksinimler

- Node.js 18+
- Yarn (`npm install -g yarn`)
- PostgreSQL 14+ (ya da `docker compose up postgres`)

### 1. Veritabanı

```sql
CREATE USER authuser WITH PASSWORD 'sifreniz';
CREATE DATABASE auth_dashboard OWNER authuser;
```

### 2. Backend

```bash
cd backend
yarn install
cp .env.example .env.development
```

`.env.development` içindeki `DATABASE_URL`, `JWT_SECRET` ve
`JWT_REFRESH_SECRET` alanlarını doldurun. Secret üretmek için:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Tabloları oluşturun ve sunucuyu başlatın:

```bash
yarn migrate
yarn dev
```

Backend `http://localhost:4000` adresinde çalışır.

İsteğe bağlı olarak, rol bazlı erişimi denemek için admin hesabı
(`.env.development` içindeki `ADMIN_EMAIL` / `ADMIN_PASSWORD` kullanılır):

```bash
yarn seed
```

### 3. Frontend

```bash
cd frontend
yarn install
cp .env.example .env.development
yarn dev
```

Frontend `http://localhost:3000` adresinde çalışır.

### 4. İlk kullanıcıyla giriş

**Kayıt olduktan sonra doğrudan giriş yapılamaz.** E-posta doğrulaması
zorunludur ve projede gerçek bir e-posta servisi yoktur (gerekçesi
[Bilinen sınırlar](#bilinen-sınırlar-ve-yapamadıklarım) bölümünde). Doğrulama
bağlantısı **backend terminaline** yazdırılır:

```
--- E-POSTA DOĞRULAMA ---
Alıcı : kullanici@example.com
Link  : http://localhost:4000/api/auth/verify-email?token=...
```

Bu bağlantıyı tarayıcıya yapıştırın; `/login?verified=success` adresine
yönlendirilir ve giriş yapabilirsiniz.

Doğrulama adımını atlamak isterseniz `yarn seed` ile oluşturulan admin hesabı
zaten doğrulanmış gelir.

### Backend komutları

| Komut | Açıklama |
|---|---|
| `yarn dev` | nodemon ile geliştirme sunucusu |
| `yarn start` | production sunucusu |
| `yarn migrate` | migration'ları uygular |
| `yarn migrate:undo` | son migration'ı geri alır |
| `yarn migrate:status` | migration durumunu listeler |
| `yarn seed` | admin hesabını oluşturur |

---

## Ortam değişkenleri

Her iki tarafta da `.env.development` ve `.env.production` kullanılır; ikisi de
`.gitignore`'dadır. Repoda yalnızca `.env.example` bulunur. Kodda sabit URL,
port veya secret yoktur.

### Backend

| Değişken | Ne işe yarar |
|---|---|
| `PORT` | Sunucunun dinleyeceği port |
| `NODE_ENV` | `development` / `production`. Hangi `.env` dosyasının okunacağını ve cookie'lerin `secure` bayrağını belirler |
| `DATABASE_URL` | PostgreSQL bağlantı adresi |
| `DB_LOGGING` | Sequelize SQL loglarını açar (`true`/`false`) |
| `FRONTEND_URL` | CORS izni ve şifre sıfırlama bağlantıları. Virgülle birden fazla origin verilebilir; bağlantı üretiminde **listenin ilki** kanonik adres sayılır |
| `BACKEND_URL` | E-posta doğrulama bağlantılarının üretildiği adres |
| `JWT_SECRET` | **Access** token imzalama anahtarı |
| `JWT_REFRESH_SECRET` | **Refresh** token imzalama anahtarı. `JWT_SECRET` ile aynı olursa uygulama başlamaz |
| `ACCESS_TOKEN_TTL` | Access token ömrü (varsayılan `15m`) |
| `REFRESH_TOKEN_TTL` | Refresh token ömrü (varsayılan `7d`) |
| `COOKIE_SAME_SITE` | `lax` / `strict` / `none`. Deploy topolojisine göre seçilir (aşağıya bakın) |
| `COOKIE_DOMAIN` | Cookie'nin paylaşılacağı üst domain (genelde boş) |
| `TRUST_PROXY` | Reverse proxy arkasında rate limit'in gerçek IP'yi görmesi için |
| `FIREBASE_PROJECT_ID` | Firebase servis hesabı proje kimliği |
| `FIREBASE_CLIENT_EMAIL` | Firebase servis hesabı e-postası |
| `FIREBASE_PRIVATE_KEY` | Firebase servis hesabı özel anahtarı (satır sonları `\n` olarak) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `yarn seed` ile oluşturulacak admin hesabı |

`PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL` ve
`BACKEND_URL` zorunludur; eksikse sunucu yarı çalışır durumda ayağa kalkmak
yerine hangi değişkenin eksik olduğunu söyleyen bir hatayla durur. `PORT` de
bilerek zorunlu tutuldu: kodda varsayılan bir port bırakmamak için.

`FIREBASE_*` değerleri opsiyoneldir — yoksa uygulama çalışmaya devam eder,
yalnızca Google girişi devre dışı kalır.

### Frontend

Vite yalnızca `VITE_` ön ekli değişkenleri istemciye aktarır. **Buradaki her
değer tarayıcıya gider, gizli bilgi konulmaz.** Firebase Web API anahtarı gizli
bir bilgi değil, projeyi tanımlayan bir kimliktir; asıl koruma Firebase
Console'daki yetkili alan adı listesindedir.

| Değişken | Ne işe yarar |
|---|---|
| `VITE_API_URL` | Backend kök adresi (kod sonuna `/api` ekler) |
| `VITE_PORT` | Vite geliştirme sunucusunun portu |
| `VITE_FIREBASE_API_KEY` | Firebase Web API anahtarı |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase proje kimliği |
| `VITE_FIREBASE_APP_ID` | Firebase uygulama kimliği |
| `VITE_FIREBASE_MEASUREMENT_ID` | Analytics kimliği (opsiyonel) |

---

## API dokümantasyonu

Tüm uçlar `/api` altındadır. `GET` dışındaki her istek `X-CSRF-Token` başlığı
ister. Kimlik doğrulaması cookie üzerinden yapılır; hiçbir uç `Authorization`
başlığı kabul etmez.

| Method | Uç | Auth | Gövde | Açıklama |
|---|---|---|---|---|
| `GET` | `/health` | — | — | Sunucu durumu |
| `GET` | `/auth/csrf` | — | — | CSRF token'ı verir ve cookie'ye yazar |
| `POST` | `/auth/register` | — | `{ email, password }` | Kayıt. Şifre bcrypt ile hash'lenir, doğrulama bağlantısı gönderilir. Oturum açmaz |
| `GET` | `/auth/verify-email?token=` | — | — | E-postayı doğrular, frontend'e yönlendirir |
| `POST` | `/auth/login` | — | `{ email, password }` | Giriş. Access + refresh cookie'lerini yazar |
| `POST` | `/auth/google` | — | `{ idToken }` | Firebase ID token'ını doğrular, oturumu kendi cookie'lerimizle kurar |
| `POST` | `/auth/refresh` | refresh cookie | — | Token rotasyonu |
| `POST` | `/auth/logout` | refresh cookie | — | Bu cihazın oturumunu kapatır |
| `POST` | `/auth/logout-all` | access **veya** refresh | — | Tüm cihazlardan çıkış |
| `POST` | `/auth/forgot-password` | — | `{ email }` | Sıfırlama bağlantısı gönderir |
| `POST` | `/auth/reset-password` | — | `{ token, newPassword }` | Şifreyi değiştirir, tüm oturumları düşürür |
| `POST` | `/auth/set-password` | access | `{ currentPassword?, newPassword }` | Google hesabına şifre ekler, şifresi olanda değiştirir |
| `GET` | `/auth/me` | access | — | Oturumdaki kullanıcı |
| `GET` | `/dashboard` | access | — | Role göre değişen panel verisi |
| `GET` | `/admin/users` | access + `admin` | — | Kullanıcı listesi |

**Cevap biçimi.** Başarılı cevaplar uca göre değişir. Hatalar her zaman
`{ "error": "mesaj" }` şeklindedir; istemcinin davranış değiştirmesi gereken
durumlarda ayrıca bir `code` alanı bulunur:

| Kod | Anlamı |
|---|---|
| `NO_SESSION` | Cookie hiç yok |
| `TOKEN_EXPIRED` | Access token süresi dolmuş, yenileme denenebilir |
| `INVALID_TOKEN` | Token geçersiz, yenileme denenmemeli |
| `EMAIL_NOT_VERIFIED` | Şifre doğru ama e-posta doğrulanmamış |
| `CSRF_MISSING` / `CSRF_INVALID` | CSRF başlığı eksik veya eşleşmiyor |

Mesaj metnine göre dallanmak yerine bu kodların kullanılmasının sebebi, metin
değiştiğinde istemci mantığının bozulmaması.

---

## Tamamlanan seviyeler

### Seviye 1 — Temel auth akışı

- Kayıt: e-posta + şifre, bcrypt (12 round) ile hash'lenip PostgreSQL'e yazılır
- Giriş: JWT üretilir ve httpOnly cookie olarak yazılır; cevap gövdesinde token yoktur
- Dashboard: backend'de `requireAuth` middleware'i, frontend'de `ProtectedRoute`
  ile korunur. `/dashboard` adresine doğrudan gidilse bile oturum yoksa
  `/login`'e yönlendirilir
- Çıkış: cookie'ler temizlenir, refresh token veritabanında iptal edilir
- Doğrulama: boş alan, e-posta formatı ve minimum şifre uzunluğu (8) backend'de
  kontrol edilir

### Seviye 2 — Access + refresh ve ortam farkındalığı

- Access (15 dk) ve refresh (7 gün) token'ları ayrı httpOnly cookie'lerde
- `/auth/refresh` ucu; frontend'de RTK Query `baseQuery`'si 401 aldığında
  kullanıcı fark etmeden yeniler ve isteği tekrarlar
- Rol bazlı erişim: `user` / `admin`. Panel içeriği role göre değişir ve admin
  verisi normal kullanıcıya gönderilmez. `/admin/users` ucu backend'de
  `requireRoles('admin')` ile korunur
- CORS `credentials: true` + frontend `credentials: 'include'`
- Cookie bayrakları ortamdan türetilir: `secure` `NODE_ENV`'e, `sameSite`
  `COOKIE_SAME_SITE`'a bağlı
- Google ile giriş/kayıt: Firebase üzerinden. Hesap yoksa oluşturulur, varsa
  mevcut hesaba bağlanır
- Migration: tablolar `sequelize-cli` migration'larıyla oluşturulur

### Seviye 3 — Production seviyesi güvenlik

- **Refresh token rotation:** token'ların SHA-256 özeti veritabanında tutulur,
  her yenilemede eskisi iptal edilir
- **Reuse detection:** iptal edilmiş bir token tekrar sunulursa o kullanıcının
  tüm refresh token'ları iptal edilir. Çıkış sonrası çalınmış bir token çalışmaz
- **Revocation:** "tüm cihazlardan çıkış" desteklenir; şifre değiştiğinde de
  otomatik tetiklenir
- **CSRF koruması:** double-submit cookie deseni (gerekçesi ve sınırı aşağıda)
- **Rate limiting:** giriş, kayıt, şifre sıfırlama ve Google girişi uçlarında
- **Güvenlik başlıkları:** helmet
- **Ek akışlar:** hem e-posta doğrulama hem şifre sıfırlama
- **Loglama:** şifreler, token'lar ve query string parametreleri maskelenir

---

## Tasarım ve güvenlik kararları

**Token neden cookie'de, localStorage'da değil.** `localStorage`'a JavaScript
erişebilir, dolayısıyla tek bir XSS açığı tüm oturumları çalınabilir yapar.
httpOnly cookie'yi JavaScript okuyamaz. Bunun bedeli CSRF'e açık hale gelmek;
bu yüzden ayrı bir CSRF katmanı eklendi.

**CSRF: neden sadece `sameSite` yetmedi.** `sameSite=strict` tek başına yeterli
görünüyor, ancak frontend ve backend farklı domainlerde deploy edilirse
cookie'lerin gidebilmesi için `sameSite=none` gerekiyor ve o anda bu koruma
tamamen ortadan kalkıyor. Bu yüzden ortamdan bağımsız çalışan double-submit
cookie deseni kullanıldı: `csrfToken` cookie'si bilerek httpOnly değil,
frontend değeri okuyup `X-CSRF-Token` başlığına koyuyor. Saldırgan bir site
same-origin policy nedeniyle cookie'yi okuyamadığı için doğru başlığı
üretemiyor. `sameSite` de ayrıca ayarlanıyor, iki katman birlikte çalışıyor.

**Bu desenin bilinen sınırı.** İmzasız double-submit, cookie'yi *yazabilen* bir
saldırgana karşı korumasız: aynı üst domain altındaki ele geçirilmiş bir alt
alan adı (`blog.example.com`) parent domain'e kendi `csrfToken` cookie'sini
yazıp başlıkla eşleştirebilir. Tam çözüm, token'ı oturuma HMAC ile bağlamak
(OWASP'ın "signed double-submit" önerisi). Burada uygulamadım, çünkü CSRF
token'ı giriş/kayıt gibi henüz oturum olmayan uçlarda da gerekiyor ve bağlamayı
doğru kurmak ayrı bir tasarım işi. Bu ödevin tehdit modelinde mevcut desen
yeterli; sınırını bilerek bıraktım.

**Access ve refresh token'lar ayrı anahtarlarla imzalanıyor** ve payload'da bir
`type` claim'i taşıyor. Aynı anahtar kullanılsaydı bir access token refresh
yerine sunulabilirdi.

**Refresh token'lar veritabanında düz metin tutulmuyor.** Yalnızca SHA-256
özeti saklanıyor; veritabanı sızsa bile oradaki değerle oturum açılamaz. bcrypt
kullanılmadı, çünkü bcrypt'in yavaşlığı tahmin edilebilir şifreleri korumak
için; bu değerler zaten 256 bit rastgele.

**Rotasyon eşzamanlılığı.** Rotasyonun saf hali gerçek bir hataya yol açıyor:
aynı anda iki istek (React StrictMode, iki açık sekme, yeniden denenen istek)
aynı refresh token'ı sunduğunda ikincisi "token çalınmış" sanılıp kullanıcının
tüm oturumları kapanıyordu. Çözüm iki parçalı: (1) tüm kontrol ve yazma
işlemleri tek transaction içinde ve satır `FOR UPDATE` ile kilitlenerek
yapılıyor; (2) iptal edilmiş bir token, iptalinden sonraki 20 saniye içinde ve
yerine geçen token hâlâ aktifse "paralel istek" kabul ediliyor. Bu pencerenin
dışındaki her tekrar gerçek reuse sayılıp tüm oturumlar düşürülüyor.

Zincirin devamının aktif olması şartı önemli: yalnızca "yakında rotate edildi
mi" diye bakmak, `logout-all` ile sonlandırılmış bir oturumun pencere içinde
diriltilmesine izin veriyordu.

**Güvenlik iptali transaction dışında yapılıyor.** Reuse tespit edildiğinde
iptali transaction içinde yapıp sonra hata fırlatmak, rollback nedeniyle iptali
de geri alıyordu. İptal artık kendi işleminde çalışıyor.

**Frontend'de tek bir yenileme isteği.** Sayfada birkaç sorgu aynı anda 401
alabiliyor. Her biri ayrı `/auth/refresh` çağırsaydı, rotasyon nedeniyle ilki
token'ı değiştirir, kalanlar eski token'la gelir ve backend bunu reuse sayıp
oturumu kapatırdı. `baseQuery` devam eden yenileme isteğini saklayıp hepsinin
onu beklemesini sağlıyor.

**Google girişinde `email_verified` zorunlu.** Firebase'den gelen token'daki
e-posta doğrulanmamışsa giriş reddediliyor. Aksi halde saldırgan, kurbanın
e-postasıyla doğrulanmamış bir Google hesabı açıp hesap eşleştirme adımında
sistemdeki gerçek hesaba bağlanabilirdi. Eşleştirme önce `google_uid`, sonra
e-posta üzerinden yapılıyor; böylece aynı e-posta için ikinci kayıt oluşmuyor.

**Google token'ı frontend'de saklanmıyor.** Firebase ID token'ı alınır alınmaz
backend'e gönderiliyor, orada `verifyIdToken` ile doğrulanıyor ve oturum kendi
httpOnly cookie'lerimizle kuruluyor.

**Firebase `getAuth()` yerine `initializeAuth(... inMemoryPersistence)`.**
`getAuth()`'un varsayılan persistence zinciri
`[indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]`
olduğu için Google ID token'ı popup kapanır kapanmaz tarayıcı deposuna
yazılıyordu. Oturumu kendi cookie'lerimizle yönettiğimiz için buna ihtiyaç yok
ve "token yalnızca httpOnly cookie'de" kuralını fiilen deliyordu.
`inMemoryPersistence` ile token yalnızca sekme belleğinde kalıyor; derlenen
pakette `firebase:authUser` (localStorage anahtarı) ve `firebaseLocalStorageDb`
(IndexedDB veritabanı) artık hiç geçmiyor.

**Firebase, Passport + OAuth2 yerine.** Ödev metni `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` değişkenlerinden bahsediyor ama
Firebase kullanıldığı için bunlara gerek kalmıyor: OAuth2 akışını ve callback'i
Firebase kendi tarafında yönetiyor, bize yalnızca Admin SDK bilgileri gerekiyor.
"Callback URL dev ve production'da farklı olacak" şartının Firebase'deki
karşılığı, her ortam için ayrı Firebase projesi kullanmak ve
Authentication > Settings > Authorized domains listesini ortama göre ayarlamak
(dev'de `localhost`, production'da gerçek alan adı). Bu değerler
`.env.development` ve `.env.production` üzerinden yönetiliyor.

**SQL injection.** Tüm sorgular Sequelize üzerinden parametreli çalışıyor.
Seeder'daki tek ham sorgu da `replacements` ile parametreli.

**Kullanıcı enumerasyonu.** `/auth/forgot-password` hesabın varlığından
bağımsız olarak hep aynı mesajı dönüyor. Girişte kullanıcı bulunamasa bile
sahte bir hash ile `bcrypt.compare` çalıştırılıyor (cevap süresinin bilgi
sızdırmaması için) ve "e-posta doğrulanmamış" bilgisi ancak şifre
doğrulandıktan sonra veriliyor.

**Loglama.** Gövdedeki hassas alanların yanı sıra query string parametreleri de
maskeleniyor — e-posta doğrulama bağlantısındaki token `?token=` ile geldiği
için varsayılan morgan formatı bunu düz metin olarak loglardı.

**Hata yönetimi.** Controller'lar `ApiError` fırlatıyor, cevabın şekli tek bir
`errorHandler` middleware'inde belirleniyor. Beklenmeyen hatalarda istemciye
ayrıntı sızdırılmıyor; stack trace yalnızca sunucu logunda kalıyor.

**`sequelize.sync()` kullanılmıyor.** Şema migration'larla yönetiliyor;
`sync()` bunları atlayarak tabloyu sessizce değiştirebileceği için devre dışı.

### Deploy topolojisine göre `COOKIE_SAME_SITE`

| Durum | Değer |
|---|---|
| Geliştirme (`localhost:3000` ↔ `localhost:4000`) | `lax` |
| Aynı site (`app.example.com` ↔ `api.example.com`) | `strict` veya `lax` |
| Farklı site (`app.vercel.app` ↔ `api.render.com`) | `none` (+ `secure` zorunlu, HTTPS şart) |

---

## Production secret yönetimi

### Secret'ların repoya girmesini engelleyen üç katman

**1. `.gitignore`** — tüm `.env.*` dosyaları dışlanmış (`.env.example` hariç).

**2. `pre-commit` hook** — `.gitignore` tek başına yeterli değil: `git add -f`
onu atlıyor ve bir dosya bir kez commit'lendiğinde geçmişten temizlemek zor.
`.githooks/pre-commit` hem `.env` dosyalarını hem de başka dosyalara
yapıştırılmış secret'ları (private key, Google API anahtarı, şifreli bağlantı
adresi, doldurulmuş `JWT_SECRET`/`ADMIN_PASSWORD`) yakalıyor.

Hook repoyla birlikte geliyor ama Git'in onu kullanması için her klonda bir kez
şu komut çalıştırılmalı:

```bash
git config core.hooksPath .githooks
```

Yanlış alarm durumunda `git commit --no-verify` ile atlanabiliyor.

**3. `.dockerignore`** — `.env` dosyaları Docker imajına kopyalanmıyor.

### Sunucuda

`.env.production` sunucuda elle oluşturuluyor. Gerçek bir deploy'da bu değerler
dosya yerine platformun secret mekanizmasından okunmalı: Render/Railway/Heroku
environment variables, AWS Secrets Manager, Google Secret Manager, Kubernetes
Secrets. Uygulama tarafında değişiklik gerekmiyor — `config/env.js` zaten
`process.env`'i okuyor, dosya yalnızca yerel geliştirme kolaylığı.

Kontrol listesi:

- [ ] `JWT_SECRET` ve `JWT_REFRESH_SECRET` farklı ve en az 32 rastgele bayt
- [ ] `NODE_ENV=production` (cookie'ler `secure` olur)
- [ ] `COOKIE_SAME_SITE` deploy topolojisine uygun
- [ ] `FRONTEND_URL` / `BACKEND_URL` gerçek HTTPS adresleri
- [ ] `TRUST_PROXY` reverse proxy arkasındaysa ayarlı
- [ ] Production için ayrı Firebase projesi ve yetkili alan adı listesi
- [ ] Seed ile oluşturulan admin hesabının şifresi değiştirilmiş

---

## Bilinen sınırlar ve yapamadıklarım

- **Gerçek e-posta gönderimi yok.** Ücretsiz planların sınırlı olması ve ödev
  kapsamını büyütmemek için bağlantılar terminale yazdırılıyor. Entegrasyon
  noktası `mailer.service.js` içinde tek bir fonksiyona indirgendi; gerçek bir
  sağlayıcıya geçmek yalnızca o fonksiyonu değiştirmeyi gerektiriyor.

- **Otomatik test yok.** Tüm akışlar elle (curl ve tarayıcı üzerinden)
  doğrulandı; Jest/Supertest ile bir test paketi yazmaya zaman kalmadı.
  Yazsaydım ilk hedefim rotasyon ve reuse detection senaryoları olurdu, çünkü
  en kırılgan kısım orası.

- **Access token çıkış sonrası TTL'i kadar geçerli kalıyor.** Access token
  stateless olduğu için çıkışta yalnızca cookie siliniyor ve refresh token
  iptal ediliyor; teoride kopyalanmış bir access token en fazla 15 dakika daha
  kullanılabilir. Kapatmanın yolu her istekte veritabanına bakmak (yani
  stateless olmaktan vazgeçmek) veya kısa ömürlü bir deny-list tutmak. Bu
  ölçekte maliyetine değer görmedim ama bilinçli bir tercih.

- **Rate limit bellekte ve IP bazlı tutuluyor.** Tek instance için yeterli;
  birden fazla sunucu çalıştırılırsa Redis tabanlı bir store gerekir. Ayrıca
  sayaç yalnızca IP'ye baktığı için ortak NAT arkasındaki bir kullanıcının
  başarısız denemeleri aynı çıkıştaki diğerlerini de yavaşlatır. Doğrusu IP
  **ve** hesap için iki ayrı limit işletmek; tek bir birleşik anahtar kullanmak
  ise korumayı zayıflatırdı (saldırgan e-postayı değiştirerek sayacı
  sıfırlayabilirdi), o yüzden bilinçli olarak IP limitinde bıraktım.

- **Refresh token temizliği basit bir `setInterval` ile yapılıyor.** Gerçek bir
  production kurulumunda bu ayrı bir cron/worker işi olmalı.
