# Auth Dashboard

Node.js + Express, React + Vite ve PostgreSQL ile geliştirilmiş, kayıt / giriş /
korumalı dashboard akışı sunan tam bir web uygulaması.

Token'lar **yalnızca httpOnly cookie** ile taşınır; `localStorage` veya
`sessionStorage` hiç kullanılmaz.

**Tamamlanan seviye: Seviye 3 (bonus dahil).** Ayrıntılar aşağıda
[Tamamlanan seviyeler](#tamamlanan-seviyeler) bölümünde.

---

## İçindekiler

- [Teknolojiler](#teknolojiler)
- [Proje yapısı](#proje-yapısı)
- [Kurulum ve çalıştırma](#kurulum-ve-çalıştırma)
- [Ortam değişkenleri](#ortam-değişkenleri)
- [API uçları](#api-uçları)
- [Tamamlanan seviyeler](#tamamlanan-seviyeler)
- [Tasarım ve güvenlik kararları](#tasarım-ve-güvenlik-kararları)
- [Production secret yönetimi](#production-secret-yönetimi)
- [Bilinen sınırlar ve yapamadıklarım](#bilinen-sınırlar-ve-yapamadıklarım)

---

## Teknolojiler

| Katman | Teknoloji |
|---|---|
| Backend | Node.js + Express 5 |
| Frontend | React 19 + Vite + TailwindCSS v4 |
| State / veri katmanı | Redux Toolkit + RTK Query |
| Yönlendirme | React Router |
| Veritabanı | PostgreSQL |
| ORM & migration | Sequelize + sequelize-cli |
| Oturum | JWT (access + refresh), httpOnly cookie |
| Google ile giriş | Firebase Authentication |
| Paket yöneticisi | **Yarn** |

---

## Proje yapısı

```
backend/
  index.js                      Sunucuyu başlatır (DB bağlantısı, listen, graceful shutdown)
  src/
    app.js                      Express uygulaması ve middleware sırası
    config/
      env.js                    NODE_ENV'e göre .env yükler, zorunlu değişkenleri doğrular
      database.js               Sequelize bağlantısı
      config.js                 sequelize-cli'nin okuduğu konfigürasyon
      firebase.js               Firebase Admin SDK (opsiyonel)
    routes/                     auth.routes.js · dashboard.routes.js
    controllers/                auth.controller.js · dashboard.controller.js
    services/                   session.service.js (token yaşam döngüsü) · mailer.service.js
    middleware/                 auth · csrf · rateLimit · requestLogger · error
    models/
      index.js                  Klasördeki modelleri otomatik yükler
      user.js · refreshToken.js
    utils/                      token.js · apiError.js · validation.js · logger.js
    migrations/ · seeders/

frontend/
  src/
    main.jsx                    Giriş noktası (Redux Provider)
    App.jsx                     Router + oturum bootstrap
    app/
      store.js                  Redux store
      baseQuery.js              RTK Query baseQuery: CSRF başlığı + otomatik token yenileme
    features/auth/
      authApi.js                Tüm API uçları (RTK Query)
      authSlice.js              Oturum durumu (token DEĞİL, sadece kullanıcı bilgisi)
    routes/                     ProtectedRoute · PublicOnlyRoute
    pages/                      Login · Register · ForgotPassword · ResetPassword · Dashboard · Admin · NotFound
    components/                 GoogleButton · layout/ · ui/
    lib/                        firebase.js · errors.js
```

**Neden bu yapı:** Endpoint'ler `index.js`'te toplandığında dosya büyüdükçe
okunamaz hale geliyor. Route / controller / service ayrımı sayesinde bir uç
eklemek tek bir route satırı + bir controller fonksiyonu demek. Token üretimi,
cookie bayrakları ve hash'leme tek bir yerde (`utils/token.js`) toplandığı için
"cookie ayarını değiştirmek" tek satırlık bir iş.

**Modeller neden otomatik yükleniyor:** `models/index.js` klasörü tarayıp her
dosyanın dışa aktardığı fabrika fonksiyonunu çağırıyor. Yeni bir model eklemek
için sadece `src/models/<ad>.js` oluşturmak yeterli; `index.js`'i düzenlemek
gerekmiyor. İlişkiler, tüm modeller tanımlandıktan sonra `associate()` ile
kuruluyor — böylece dosyaların yüklenme sırası önemsiz oluyor.

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

`.env.development` içindeki `DATABASE_URL`, `JWT_SECRET` ve `JWT_REFRESH_SECRET`
alanlarını doldurun. Secret üretmek için:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Tabloları oluşturun ve sunucuyu başlatın:

```bash
yarn migrate
yarn dev
```

Backend `http://localhost:4000` adresinde çalışır.

İsteğe bağlı — rol bazlı erişimi test etmek için admin hesabı oluşturun
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

### Backend komutları

| Komut | Açıklama |
|---|---|
| `yarn dev` | nodemon ile geliştirme sunucusu |
| `yarn start` | production sunucusu |
| `yarn migrate` | migration'ları uygular |
| `yarn migrate:undo` | son migration'ı geri alır |
| `yarn migrate:status` | migration durumunu listeler |
| `yarn seed` | admin hesabını oluşturur |

### E-posta gönderimi hakkında

Gerçek bir e-posta servisi (SendGrid, Mailgun...) entegre edilmedi. Doğrulama ve
şifre sıfırlama bağlantıları **backend terminaline** yazdırılır:

```
--- E-POSTA DOĞRULAMA ---
Alıcı : kullanici@example.com
Link  : http://localhost:4000/api/auth/verify-email?token=...
```

Bu simülasyon `src/services/mailer.service.js` içinde tek bir fonksiyonda
toplandı; gerçek bir sağlayıcıya geçmek yalnızca o dosyayı değiştirmeyi
gerektirir. Production'da bu linkler bilinçli olarak loglanmaz.

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
| `FRONTEND_URL` | CORS izni ve şifre sıfırlama linkleri. Virgülle birden fazla origin verilebilir |
| `BACKEND_URL` | E-posta doğrulama linklerinin üretildiği adres |
| `JWT_SECRET` | **Access** token imzalama anahtarı |
| `JWT_REFRESH_SECRET` | **Refresh** token imzalama anahtarı. `JWT_SECRET` ile aynı olursa uygulama başlamaz |
| `ACCESS_TOKEN_TTL` | Access token ömrü (varsayılan `15m`) |
| `REFRESH_TOKEN_TTL` | Refresh token ömrü (varsayılan `7d`) |
| `COOKIE_SAME_SITE` | `lax` / `strict` / `none`. Deploy topolojisine göre seçilir (aşağıya bakın) |
| `COOKIE_DOMAIN` | Cookie'nin paylaşılacağı üst domain (genelde boş) |
| `TRUST_PROXY` | Reverse proxy arkasında rate limit'in gerçek IP'yi görmesi için |
| `FIREBASE_PROJECT_ID` | Firebase servis hesabı proje ID'si |
| `FIREBASE_CLIENT_EMAIL` | Firebase servis hesabı e-postası |
| `FIREBASE_PRIVATE_KEY` | Firebase servis hesabı özel anahtarı (satır sonları `\n` olarak) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `yarn seed` ile oluşturulacak admin hesabı |

`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL` ve
`BACKEND_URL` zorunludur; eksikse sunucu yarı çalışır durumda ayağa kalkmak
yerine net bir hata ile durur. `FIREBASE_*` değerleri opsiyoneldir — yoksa
uygulama çalışmaya devam eder, yalnızca Google girişi devre dışı kalır.

### Frontend

Vite yalnızca `VITE_` ön ekli değişkenleri istemciye aktarır. **Buradaki her
değer tarayıcıya gider, gizli secret konulmaz.** Firebase Web API anahtarı gizli
bir bilgi değil, istemci tanımlayıcısıdır.

| Değişken | Ne işe yarar |
|---|---|
| `VITE_API_URL` | Backend kök adresi (kod sonuna `/api` ekler) |
| `VITE_PORT` | Vite dev sunucusunun portu |
| `VITE_FIREBASE_API_KEY` | Firebase Web API anahtarı |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase proje ID'si |
| `VITE_FIREBASE_APP_ID` | Firebase uygulama ID'si |
| `VITE_FIREBASE_MEASUREMENT_ID` | Analytics ID (opsiyonel) |

---

## API uçları

Tümü `/api` altındadır. `GET` dışındaki her istek `X-CSRF-Token` başlığı ister.

| Method | Uç | Auth | Açıklama |
|---|---|---|---|
| `GET` | `/auth/csrf` | — | CSRF token'ı verir (frontend açılışta çağırır) |
| `POST` | `/auth/register` | — | Kayıt. Şifre bcrypt ile hash'lenir, doğrulama maili gönderilir |
| `GET` | `/auth/verify-email?token=` | — | E-postayı doğrular, frontend'e yönlendirir |
| `POST` | `/auth/login` | — | Giriş. Access + refresh cookie'lerini set eder |
| `POST` | `/auth/google` | — | Firebase ID token'ı doğrular, oturumu kendi cookie'lerimizle kurar |
| `POST` | `/auth/refresh` | refresh cookie | Token rotasyonu |
| `POST` | `/auth/logout` | — | Bu cihazın oturumunu kapatır |
| `POST` | `/auth/logout-all` | access **veya** refresh | Tüm cihazlardan çıkış (revocation) |
| `POST` | `/auth/forgot-password` | — | Sıfırlama bağlantısı gönderir |
| `POST` | `/auth/reset-password` | — | Şifreyi değiştirir, tüm oturumları düşürür |
| `GET` | `/auth/me` | access | Oturumdaki kullanıcı |
| `GET` | `/dashboard` | access | Rol'e göre değişen dashboard verisi |
| `GET` | `/admin/users` | access + `admin` | Kullanıcı listesi |
| `GET` | `/health` | — | Sağlık kontrolü |

---

## Tamamlanan seviyeler

### Seviye 1 — Temel auth akışı

- Kayıt: e-posta + şifre, **bcrypt** (12 round) ile hash'lenip PostgreSQL'e yazılır
- Giriş: JWT üretilir ve **httpOnly cookie** olarak set edilir; response gövdesinde token yoktur
- Dashboard: backend'de `requireAuth` middleware'i, frontend'de `ProtectedRoute` ile korunur.
  `/dashboard` adresine doğrudan gidilse bile oturum yoksa `/login`'e **yönlendirilir**
- Çıkış: cookie'ler temizlenir, refresh token veritabanında iptal edilir
- Doğrulama: boş alan, e-posta formatı ve minimum şifre uzunluğu (8) backend'de kontrol edilir

### Seviye 2 — Access + refresh ve ortam farkındalığı

- Access (15 dk) ve refresh (7 gün) token'ları **ayrı** httpOnly cookie'lerde
- `/auth/refresh` ucu; frontend'de RTK Query `baseQuery`'si 401 aldığında
  kullanıcı fark etmeden yeniler ve isteği tekrarlar
- Rol bazlı erişim: `user` / `admin`. Dashboard içeriği role göre değişir ve
  admin verisi normal kullanıcıya **hiç gönderilmez**. `/admin/users` ucu
  backend'de `requireRoles('admin')` ile korunur — UI'da gizlemekle yetinilmez
- CORS `credentials: true` + frontend `credentials: 'include'`
- Cookie bayrakları ortamdan türetilir: `secure` `NODE_ENV`'e, `sameSite`
  `COOKIE_SAME_SITE`'a bağlı. Kodda sabit değer yok
- Google ile giriş/kayıt: Firebase üzerinden. Hesap yoksa otomatik oluşturulur,
  varsa mevcut hesaba bağlanır
- Migration: tablolar `sequelize-cli` migration'larıyla oluşturulur

### Seviye 3 — Production seviyesi güvenlik

- **Refresh token rotation:** token'ların SHA-256 özeti veritabanında tutulur,
  her yenilemede eskisi iptal edilir
- **Reuse detection:** iptal edilmiş bir token tekrar sunulursa o kullanıcının
  tüm refresh token'ları iptal edilir. Logout sonrası çalınmış bir token çalışmaz
- **Revocation:** "tüm cihazlardan çıkış" desteklenir; şifre sıfırlandığında da
  otomatik olarak tetiklenir
- **CSRF koruması:** double-submit cookie deseni (aşağıda gerekçesi)
- **Rate limiting:** login, register, şifre sıfırlama ve Google girişi uçlarında
- **Ek akışlar:** hem e-posta doğrulama hem şifre sıfırlama
- **Güvenli deploy:** gerçek `.env` dosyaları repoda yok, `.dockerignore` ile
  imaja da girmez
- **Loglama:** yapılandırılmış logger; şifreler, token'lar ve **query string
  parametreleri** maskelenir

---

## Tasarım ve güvenlik kararları

**Token neden cookie'de, localStorage'da değil.** `localStorage`'a JavaScript
erişebilir, dolayısıyla tek bir XSS açığı tüm oturumları çalınabilir yapar.
httpOnly cookie'yi JavaScript okuyamaz. Bunun bedeli CSRF'e açık hale gelmektir;
bu yüzden ayrı bir CSRF katmanı eklendi.

**CSRF: neden sadece `sameSite` yetmedi.** `sameSite=strict` tek başına
yeterliymiş gibi görünüyor, ancak frontend ve backend farklı domain'lerde deploy
edilirse cookie'lerin gidebilmesi için `sameSite=none` gerekir ve o anda bu
koruma tamamen ortadan kalkar. Bu yüzden ortamdan bağımsız çalışan
**double-submit cookie** deseni kullanıldı: `csrfToken` cookie'si bilinçli
olarak httpOnly değildir, frontend değeri okuyup `X-CSRF-Token` başlığına koyar.
Saldırgan bir site, same-origin policy nedeniyle kurbanın cookie'sini okuyamaz,
dolayısıyla doğru başlığı üretemez. `sameSite` de ayrıca ayarlanır — iki katman
birlikte çalışır.

**Access ve refresh token'lar ayrı secret'larla imzalanır** ve payload'da bir
`type` claim'i taşır. Aynı secret kullanılsaydı bir access token refresh yerine
sunulabilir, bu da en iyi ihtimalle beklenmedik davranışa yol açardı.

**Refresh token'lar veritabanında düz metin tutulmaz.** Yalnızca SHA-256 özeti
saklanır; veritabanı sızsa bile oradaki değerle oturum açılamaz. (Yüksek
entropili rastgele değerler oldukları için bcrypt gerekmez.)

**Rotasyon eşzamanlılığı.** Rotasyonun saf hali gerçek bir hataya yol açıyor:
aynı anda iki istek (React StrictMode, iki açık sekme, yeniden denenen istek)
aynı refresh token'ı sunduğunda ikincisi "token çalınmış" sanılıp kullanıcının
tüm oturumları kapanıyor. Çözüm iki parçalı: (1) tüm kontrol ve yazma işlemleri
tek bir transaction içinde ve satır `FOR UPDATE` ile kilitlenerek yapılır;
(2) iptal edilmiş bir token, iptalinden sonraki 20 saniye içinde ve yerine
geçen token **hâlâ aktifse** "paralel istek" kabul edilir. Bu pencerenin
dışındaki her tekrar gerçek reuse sayılır ve tüm oturumlar düşürülür.

Zincirin devamının aktif olması şartı önemli: yalnızca "yakında rotate edildi
mi" diye bakmak, `logout-all` ile sonlandırılmış bir oturumun pencere içinde
diriltilmesine izin veriyordu. Artık ardıl token iptalliyse (logout-all veya
reuse tespiti nedeniyle) grace uygulanmaz.

**Güvenlik iptali transaction dışında yapılır.** Reuse tespit edildiğinde iptali
transaction içinde yapıp sonra hata fırlatmak, rollback nedeniyle iptali geri
alıyordu. İptal artık kendi işleminde çalışır.

**Google girişinde `email_verified` zorunlu.** Firebase'den gelen token'daki
e-posta doğrulanmamışsa giriş reddedilir. Aksi halde saldırgan, kurbanın
e-postasıyla doğrulanmamış bir hesap açıp mevcut hesabı ele geçirebilirdi.
Eşleştirme önce `google_uid` üzerinden, sonra e-posta üzerinden yapılır; böylece
aynı e-posta için ikinci bir kayıt oluşmaz.

**Google token'ı frontend'de saklanmaz.** Firebase ID token'ı alınır alınmaz
backend'e gönderilir, orada `verifyIdToken` ile doğrulanır ve oturum bizim kendi
httpOnly cookie'lerimizle kurulur. Firebase oturumu hemen kapatılır.

**Firebase, Passport + OAuth2 yerine.** Ödev metni `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` değişkenlerinden bahsediyor, ama
Firebase kullanıldığı için bunlara gerek kalmıyor: Firebase OAuth2 akışını ve
callback'i kendi tarafında yönetiyor, bize yalnızca Admin SDK bilgileri gerekiyor.
Ödevin "callback URL dev ve production'da farklı olacak" şartının Firebase'deki
karşılığı, her ortam için **ayrı Firebase projesi/web app** kullanmak ve
Authentication > Settings > Authorized domains listesini ortama göre ayarlamaktır
(dev'de `localhost`, production'da gerçek alan adı). Bu değerler
`.env.development` ve `.env.production` üzerinden yönetiliyor.

**SQL injection.** Tüm sorgular Sequelize ORM üzerinden, parametreli olarak
çalışır. Ham string birleştirmesi hiçbir yerde yok.

**Kullanıcı enumerasyonu.** `/auth/forgot-password` hesabın varlığından bağımsız
olarak hep aynı mesajı döner. Login'de kullanıcı bulunamasa bile sahte bir hash
ile `bcrypt.compare` çalıştırılır (zamanlama farkını kapatmak için) ve "e-posta
doğrulanmamış" bilgisi ancak şifre doğrulandıktan sonra açıklanır.

**Loglama.** Yapılandırılmış logger production'da tek satır JSON üretir.
Gövdedeki hassas alanların yanı sıra **query string parametreleri de** maskelenir
— e-posta doğrulama linki token'ı `?token=` ile geldiği için varsayılan morgan
formatı bunu düz metin olarak loglardı.

**Hata yönetimi.** Controller'lar `ApiError` fırlatır, cevabın şekli tek bir
`errorHandler` middleware'inde belirlenir. Beklenmeyen hatalarda istemciye
ayrıntı sızdırılmaz; stack trace yalnızca sunucu logunda kalır.

**`sequelize.sync()` kullanılmıyor.** Şema migration'larla yönetiliyor;
`sync()` bunları atlayarak tabloyu değiştirebileceği için bilinçli olarak
devre dışı.

### Deploy topolojisine göre `COOKIE_SAME_SITE`

| Durum | Değer |
|---|---|
| Geliştirme (`localhost:3000` ↔ `localhost:4000`) | `lax` |
| Aynı site (`app.example.com` ↔ `api.example.com`) | `strict` veya `lax` |
| Farklı site (`app.vercel.app` ↔ `api.render.com`) | `none` (+ `secure` zorunlu, HTTPS şart) |

---

## Production secret yönetimi

### Secret'ların repoya girmesini engelleyen üç katman

**1. `.gitignore`** — tüm `.env.*` dosyaları dışlanmıştır (`.env.example` hariç).

**2. `pre-commit` hook** — `.gitignore` tek başına yeterli değil: `git add -f`
onu atlar ve bir dosya bir kez commit'lendiğinde geçmişten temizlemek zordur.
`.githooks/pre-commit` son savunma hattıdır; hem `.env` dosyalarını hem de
başka dosyalara yapıştırılmış secret'ları (private key, Google API anahtarı,
şifreli bağlantı adresi, doldurulmuş `JWT_SECRET`/`ADMIN_PASSWORD`) yakalar.

Hook repoyla birlikte gelir ama Git'in onu kullanması için her klonda bir kez
şu komut çalıştırılmalıdır:

```bash
git config core.hooksPath .githooks
```

Yanlış alarm durumunda `git commit --no-verify` ile atlanabilir.

**3. `.dockerignore`** — `.env` dosyaları Docker imajına kopyalanmaz.

### Sunucuda

`.env.production` sunucuda **elle** oluşturulur.

Gerçek bir deploy'da bu değerler dosya yerine platformun secret mekanizmasından
okunmalıdır: Render/Railway/Heroku environment variables, AWS Secrets Manager,
Google Secret Manager, Kubernetes Secrets vb. Uygulama tarafında değişiklik
gerekmez — `config/env.js` zaten `process.env`'i okur, dosya yalnızca lokal
geliştirme kolaylığıdır.

Kontrol listesi:

- [ ] `JWT_SECRET` ve `JWT_REFRESH_SECRET` farklı ve en az 32 rastgele bayt
- [ ] `NODE_ENV=production` (cookie'ler `secure` olur)
- [ ] `COOKIE_SAME_SITE` deploy topolojisine uygun
- [ ] `FRONTEND_URL` / `BACKEND_URL` gerçek HTTPS adresleri
- [ ] `TRUST_PROXY` reverse proxy arkasındaysa ayarlı
- [ ] Production için ayrı Firebase projesi ve yetkili domain listesi
- [ ] Seed ile oluşturulan admin hesabının şifresi değiştirilmiş

---

## Bilinen sınırlar ve yapamadıklarım

- **Gerçek e-posta gönderimi yok.** Ücretsiz planların sınırlı olması ve ödev
  kapsamını gereksiz büyütmemek için linkler terminale yazdırılıyor. Entegrasyon
  noktası `mailer.service.js` içinde tek bir fonksiyona indirgendi.

- **Otomatik test yok.** Tüm akışlar elle (curl ve tarayıcı üzerinden) doğrulandı;
  Jest/Supertest ile bir test paketi yazmaya zaman kalmadı. Yazılsaydı ilk
  hedefim rotasyon ve reuse detection senaryoları olurdu, çünkü en kırılgan
  kısım orası.

- **Access token logout sonrası TTL'i kadar geçerli kalır.** Access token
  stateless olduğu için çıkışta yalnızca cookie silinir ve refresh token iptal
  edilir; teoride kopyalanmış bir access token en fazla 15 dakika daha
  kullanılabilir. Bunu kapatmanın yolu her istekte veritabanına bakmak
  (yani stateless olmaktan vazgeçmek) veya kısa ömürlü bir deny-list tutmak.
  Bu ödül/maliyet dengesini bu ölçekte kurmaya değer görmedim, ama bilinçli
  bir tercih.

- **Rate limit bellekte tutuluyor.** Tek instance için yeterli; birden fazla
  sunucu çalıştırılırsa Redis tabanlı bir store gerekir.

- **Refresh token temizliği basit bir `setInterval` ile yapılıyor.** Gerçek bir
  production kurulumunda bu ayrı bir cron/worker işi olmalı.
