# Auth Dashboard

Staj ödevi olarak yazdığım bir kimlik doğrulama uygulaması. İki aşamalı ilerledi: önce e-posta/şifre
ve Google ile giriş yapılabilen rol bazlı bir dashboard, sonra üzerine kullanıcının kendi profilini
yönettiği bir modül. Backend Node.js + Express, veritabanı PostgreSQL, ORM Sequelize. Frontend React
+ Vite + Tailwind, veri katmanında Redux Toolkit Query. Google girişi Firebase Admin SDK ile
doğrulanıyor, profil fotoğrafları Cloudinary'de. Access ve refresh token'ları yalnızca httpOnly
cookie'de; projede hiçbir yerde localStorage yok.

## Kurulum

Node 18+, Yarn ve çalışan bir PostgreSQL gerekiyor. Önce boş bir veritabanı açın, sonra iki tarafı
ayrı terminallerde başlatın:

```bash
createdb -U postgres -O authuser auth_dashboard
cd backend && cp .env.example .env.development && yarn install && yarn migrate && yarn dev
cd frontend && cp .env.example .env.development && yarn install && yarn dev
```

JWT anahtarlarını `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` ile üretin.
İkisi aynı olursa sunucu bilerek açılmıyor; zorunlu bir değişken eksikse de yarım yapılandırmayla
çalışmasın diye hata verip duruyor. Arayüz `http://localhost:3000`, API `http://localhost:4000`. Rol
bazlı erişimi denemek için `.env.development` içine `ADMIN_EMAIL` ve `ADMIN_PASSWORD` yazıp `yarn seed`.

## Docker ile çalıştırma

`docker-compose.yml` üç servis tanımlıyor: `postgres` (postgres:16-alpine, kalıcı `pgdata`
volume'u ve healthcheck ile), `backend` ve `frontend`. Postgres bilgileri kök dizindeki bir
`.env` dosyasından (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`), uygulama secret'ları
ise `env_file` ile mevcut `.env.development` dosyalarından geliyor. Tek istisna `DATABASE_URL`:
container içinden veritabanına `postgres` servis adıyla erişildiği için compose onu ezip veriyor.
Hepsi `docker compose up --build` ile kalkıyor.

Portlar manuel kurulumla aynı: 3000, 4000, 5432. İki fark var: kendi PostgreSQL'inizi kurmanız
gerekmiyor, ve migration'ları elle çalıştırmıyorsunuz — backend imajının komutu `yarn migrate && yarn
start` olduğu için tablolar container her başladığında güncelleniyor. Sadece veritabanını Docker'dan
almak isterseniz `docker compose up postgres` yeterli.

## Migration

Tablolar elle SQL ile değil `sequelize-cli` migration'larıyla oluşturuluyor; şu an 9 dosya var ve
`sequelize.sync()` bilerek hiç çağrılmıyor. CLI'ın yolları `.sequelizerc` ile `src/` altına
yönlendirildi. Komut `cd backend && yarn migrate`, durum için `yarn migrate:status`, geri almak için
`yarn migrate:undo`. Docker'da `docker compose exec backend yarn migrate`.

## Ortam değişkenleri

`.env.development` ve `.env.production` her iki tarafta ayrı duruyor, ikisi de `.gitignore` içinde;
repoda yalnızca `.env.example` var. Hangisinin okunacağını `NODE_ENV` belirliyor, frontend'de Vite
bunu `mode`'dan seçiyor. Kodda sabit port, adres veya anahtar bırakılmadı.

| Değişken | Ne işe yarıyor |
|---|---|
| `PORT`, `NODE_ENV` | Sunucu portu ve ortam. `NODE_ENV` cookie'lerin `secure` bayrağını da belirliyor |
| `DATABASE_URL`, `DB_LOGGING` | Postgres adresi; ikincisi SQL loglarını açar |
| `FRONTEND_URL`, `BACKEND_URL` | CORS listesi ve sıfırlama linkleri; doğrulama linkinin adresi |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Access ve refresh imza anahtarları. Farklı olmak zorunda |
| `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL` | Varsayılan 15 dakika ve 7 gün |
| `COOKIE_SAME_SITE`, `COOKIE_DOMAIN`, `TRUST_PROXY` | Cookie kapsamı; sonuncusu proxy arkasında gerçek IP için |
| `FIREBASE_*`, `CLOUDINARY_*` | Google girişi ve fotoğraf depolama. Boşsa yalnızca o özellik kapanır |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `yarn seed` ile açılacak admin hesabı |

Frontend'de `VITE_API_URL`, `VITE_PORT` ve `VITE_FIREBASE_*` var. Bunlar tarayıcıya gittiği için gizli
sayılmıyor; Firebase web anahtarı parola değil, projeyi tanımlayan bir kimlik. Asıl koruma Console'daki
yetkili alan adı listesinde, dev ve production için ayrı proje kullanılıyor.

## Endpoint'ler

Hepsi `/api` altında. Kimlik cookie'den çözülüyor, hiçbir uç `Authorization` başlığı kabul
etmiyor; `GET` dışındaki her istek `X-CSRF-Token` istiyor.

| Uç | Açıklama |
|---|---|
| `POST /auth/register` | Şifre bcrypt ile hash'lenir, doğrulama linki gönderilir, oturum açılmaz |
| `POST /auth/login` | Access + refresh cookie'lerini yazar |
| `POST /auth/google` | Firebase ID token'ını doğrular, oturumu kendi cookie'lerimizle kurar |
| `POST /auth/refresh` | Token rotasyonu |
| `POST /auth/logout`, `/auth/logout-all`, `GET /auth/me` | Çıkış (bu cihaz veya tümü) ve oturum bilgisi |
| `GET /dashboard`, `GET /admin/users` | Panel verisi; ikincisi yalnızca admin |
| `GET/POST/PUT/DELETE /profile` | Profil işlemleri |
| `GET /profile/locations`, `POST/DELETE /profile/photo` | İl-ilçe listesi, fotoğraf |
| Diğer `auth` uçları | `verify-email`, `forgot-password`, `reset-password`, `set-password`, `deactivate`, `reactivate`, `delete-account`, ayrıca `health` |

```
POST /api/profile  { "firstName": "Ayşe", "lastName": "Yılmaz", "city": "Ankara" }
201 { "message": "Profiliniz oluşturuldu.", "profile": { "id": "...", "firstName": "Ayşe", ... } }
400 { "error": "Gönderilen veriler geçersiz.", "fields": { "phone": "Telefon 10-15 rakam içermeli." } }
```

Cevapta `userId` yok, kaynak zaten isteği yapanın profili. Alan bazlı hatalar `fields` içinde gelip
ilgili input'un altına yazılıyor. Davranış değiştirilmesi gereken yerlerde ayrıca `code` alanı var
(`TOKEN_EXPIRED`, `EMAIL_NOT_VERIFIED` gibi); metne göre dallanmak metin değişince bozulurdu.

## Doğrulamalar ve güvenlik kararları

Şifreler bcrypt ile 12 round hash'leniyor; varsayılan 10 donanım hızlandıkça zayıf kalıyor. Girişte
kullanıcı bulunamasa bile sahte bir hash'le karşılaştırma yapılıyor, yoksa cevap süresi hangi
e-postaların kayıtlı olduğunu ele verirdi. Aynı sebeple `forgot-password` hesap olsa da olmasa da
aynı mesajı dönüyor.

Token'lar httpOnly cookie'de olduğu için JavaScript okuyamıyor; bedeli CSRF'e açılmak, çünkü tarayıcı
cookie'yi isteği hangi site başlatırsa başlatsın gönderiyor. Bu yüzden double-submit cookie deseni
ekledim: `csrfToken` bilerek httpOnly değil, frontend değerini okuyup başlığa koyuyor, sunucu ikisini
sabit zamanlı karşılaştırıyor. Yalnızca `sameSite` yetmezdi — iki taraf farklı domainlerde deploy
edilirse `sameSite=none` gerekiyor ve koruma kalkıyor. Refresh token'ların SHA-256 özeti veritabanında
tutuluyor, her yenilemede eskisi iptal ediliyor ve iptal edilmiş bir token tekrar sunulursa sızıntı
sayılıp bütün oturumlar kapatılıyor. Kayıtlar silinmiyor iptal işaretleniyor — "vardı ama iptal edildi"
bilgisi olmadan bu tespit yapılamaz.

Bu desenin bilinen bir sınırı var: imzasız double-submit, cookie'yi *yazabilen* bir saldırgana karşı
korumasız. Aynı üst domain altındaki ele geçirilmiş bir alt alan adı, parent domain'e kendi
`csrfToken` cookie'sini yazıp başlıkla eşleştirebilir. Tam çözüm token'ı oturuma HMAC ile bağlamak
(OWASP'ın signed double-submit önerisi); uygulamadım, çünkü CSRF token'ı giriş ve kayıt gibi henüz
oturumun olmadığı uçlarda da gerekiyor ve bağlamayı doğru kurmak ayrı bir tasarım işi. Bu ödevin
tehdit modelinde mevcut desen yeterli, sınırını bilerek bıraktım.

Yetki kontrolü her zaman backend'de; frontend'deki `ProtectedRoute` sadece arayüz kolaylığı. Admin
verisi normal kullanıcıya gönderilip gizlenmiyor, cevaba hiç eklenmiyor. Profil uçlarında `userId`
imzalı token'dan alınıyor, gövdeye başkasının kimliği yazılsa dikkate alınmıyor. Hassas sütunlar
varsayılan kapsamda SELECT'e hiç girmiyor, loglarda şifre ve token'lar maskeleniyor,
giriş/kayıt/sıfırlama uçlarında rate limit var.

## Production secret yönetimi

Secret'ların repoya girmesini üç katman engelliyor. Birincisi `.gitignore`: tüm `.env.*` dosyaları
dışlanmış, yalnızca `.env.example` geçiyor. İkincisi `.githooks/pre-commit`, çünkü `.gitignore` tek
başına yetmiyor — `git add -f` onu atlıyor ve bir dosya bir kez commit'lendiğinde geçmişten
temizlemek zor. Hook hem `.env` dosyalarını hem de başka dosyalara yapıştırılmış secret'ları
(private key, Google API anahtarı, şifreli bağlantı adresi, doldurulmuş `JWT_SECRET`) yakalıyor.
Repoyla geliyor ama Git'in kullanması için her klonda bir kez `git config core.hooksPath .githooks`
çalıştırılmalı; yanlış alarmda `git commit --no-verify` ile atlanabiliyor. Üçüncüsü `.dockerignore`:
`.env` dosyaları imaja hiç kopyalanmıyor.

`.env.production` sunucuda elle oluşturuluyor. Gerçek bir deploy'da bu değerler dosya yerine
platformun secret mekanizmasından okunmalı (Render/Railway environment variables, AWS Secrets
Manager, Kubernetes Secrets); uygulama tarafında değişiklik gerekmiyor, `config/env.js` zaten
`process.env`'i okuyor. Deploy öncesi kontrol ettiklerim: iki JWT anahtarı farklı ve en az 32
rastgele bayt, `NODE_ENV=production`, `COOKIE_SAME_SITE` topolojiye uygun, `FRONTEND_URL` ve
`BACKEND_URL` gerçek HTTPS adresleri, `TRUST_PROXY` proxy arkasındaysa ayarlı, production için ayrı
Firebase projesi, seed ile açılan admin hesabının şifresi değiştirilmiş.

## Tamamlanan seviyeler

Birinci ödevde üç seviyenin üçü de bitti: temel auth akışı, access + refresh ayrımı ve ortam
farkındalığı, bonus güvenlik katmanı (rotation, reuse detection, CSRF, rate limiting, e-posta
doğrulama ve şifre sıfırlama). İkinci ödevde Seviye 1 ve 2 tamam, Seviye 3'teki beş bonusun beşi de
yapıldı: fotoğraf, şehir-ilçe, tamamlama oranı, şifre değiştirme, hesabı devre dışı bırakma.

Testler `backend/src/__tests__` altında: Jest ve Supertest ile profilin oluşturma, görüntüleme,
güncelleme ve yetkisiz erişim senaryolarını kapsayan 7 test var, ayrı bir test veritabanı
kullanıyorlar (`yarn migrate:test && yarn test`). Bitmeyen tek şey gerçek e-posta gönderimi;
akışın tamamı çalışıyor ama linkler bir sağlayıcıya gönderilmek yerine terminale yazılıyor,
entegrasyon noktası `mailer.service.js` içinde tek bir fonksiyona indirgendi.

## Karşılaştığım sorunlar

En çok Google girişiyle uğraştım. Firebase'in `getAuth()` fonksiyonu ID token'ı popup kapanır
kapanmaz IndexedDB'ye yazıyor ve bunu fark etmem zaman aldı; "token yalnızca httpOnly cookie'de
durur" kuralını deliyordu. `initializeAuth(..., inMemoryPersistence)` ile token sadece sekme
belleğinde kaldı.

Rotation'ı yazdıktan sonra sürekli oturumdan atılıyordum. Sebebi React StrictMode'un efektleri iki
kez çalıştırması: aynı token neredeyse aynı anda iki kez sunuluyor, ikincisi "çalınmış" sayılıp
bütün oturumlar kapanıyordu. 20 saniyelik bir tolerans penceresi ekledim, ama pencere yalnızca
zincirin devamı yaşıyorsa geçerli; yoksa logout-all ile kapatılmış oturum da diriltilebiliyordu.

`FRONTEND_URL`'i hem CORS listesi hem link üretimi için kullanınca, virgülle iki origin yazdığım anda
sıfırlama linkleri `http://a,http://b/reset` gibi bozuk çıktı. Değişkeni ikiye ayırdım: izin listesi
ayrı, link üretiminde kullanılan kanonik adres ayrı.

Testleri yazarken Jest, `firebase-admin`'in bağımlılığı `jose`'u yükleyemedi; paket ESM-only ve
Jest'in CommonJS çalışma zamanı onu `require` edemiyor. Çözüm zaten doğru olan şeydi: SDK'yı modül
tepesinde değil, Firebase yapılandırılmışsa koşulun içinde `require` etmek.

Son olarak bir tercih: ödevde `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` ve `GOOGLE_CALLBACK_URL`
isteniyor ama Firebase kullandığım için bunlara gerek kalmıyor, OAuth2 akışını ve callback'i
Firebase kendi tarafında yönetiyor. "Callback URL ortama göre farklı olacak" şartının karşılığı
burada, her ortam için ayrı Firebase projesi ve ortama göre ayarlanmış yetkili alan adı listesi.

## Bilinen sınırlar

Access token stateless olduğu için çıkışta yalnızca cookie siliniyor ve refresh token iptal ediliyor;
teoride kopyalanmış bir access token en fazla 15 dakika daha kullanılabilir. Kapatmanın yolu her
istekte veritabanına bakmak ya da kısa ömürlü bir deny-list tutmak — bu ölçekte maliyetine değmedi
ama bilinçli bir tercih.

Rate limit sayaçları bellekte ve IP bazlı. Tek instance için yeterli, birden fazla sunucu
çalıştırılırsa Redis destekli bir store gerekir. Ayrıca ortak NAT arkasındaki bir kullanıcının
başarısız denemeleri aynı çıkıştaki diğerlerini de yavaşlatıyor.

Süresi dolmuş refresh token kayıtlarını silen iş `setInterval` ile 6 saatte bir çalışıyor ama
açılışta bir kez çağrılmıyor. Sunucuyu 6 saat kesintisiz çalıştırmadığım için geliştirme
veritabanımda temizlik pratikte hiç çalışmamış ve onlarca ölü satır birikmişti. Doğrusu açılışta da
bir kez çağırmak; gerçek bir kurulumda zaten ayrı bir cron işi olmalı.

Testler yalnızca profil modülünü kapsıyor. En kırılgan kısım aslında rotation ve reuse detection,
sıradaki test paketini oraya yazardım.
