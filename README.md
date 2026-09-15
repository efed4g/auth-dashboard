# Auth Dashboard — Kimlik Doğrulamalı Dashboard Uygulaması

Node.js, React ve PostgreSQL kullanarak geliştirdiğim, kullanıcı kaydı, girişi ve korumalı dashboard sayfası sunan bir web uygulaması.

---

## Kurulum ve Çalıştırma Adımları

### Gereksinimler
- Node.js (v18+)
- PostgreSQL
- npm

### 1. Veritabanı Kurulumu

PostgreSQL'de yeni bir veritabanı ve kullanıcı oluşturun:

```sql
CREATE USER authuser WITH PASSWORD 'sifreniz';
CREATE DATABASE auth_dashboard OWNER authuser;
GRANT ALL PRIVILEGES ON DATABASE auth_dashboard TO authuser;
```

### 2. Backend Kurulumu

```bash
cd backend
npm install
```

`backend/.env.example` dosyasını kopyalayarak `.env.development` oluşturun ve değerleri doldurun:

```bash
copy .env.example .env.development
```

Tabloları migration ile oluşturun:

```bash
npx sequelize-cli db:migrate
```

Sunucuyu başlatın:

```bash
npm run dev
```

Backend `http://localhost:4000` adresinde çalışacaktır.

### 3. Frontend Kurulumu

```bash
cd frontend
npm install
```

`frontend/.env.example` dosyasını kopyalayarak `.env` oluşturun ve Firebase bilgilerinizi girin:

```bash
copy .env.example .env
```

Geliştirme sunucusunu başlatın:

```bash
npm start
```

Frontend `http://localhost:3000` adresinde çalışacaktır.

---

## Ortam Değişkenleri

### Backend (.env.development / .env.production)

| Değişken | Açıklama |
|---|---|
| `PORT` | Sunucunun çalışacağı port (ör: 4000) |
| `DATABASE_URL` | PostgreSQL bağlantı adresi (ör: `postgresql://authuser:sifre@localhost:5432/auth_dashboard`) |
| `JWT_SECRET` | JWT token imzalama için rastgele gizli anahtar. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` ile üretilebilir |
| `NODE_ENV` | Çalışma ortamı: `development` veya `production` |
| `FRONTEND_URL` | CORS izni için frontend adresi (ör: `http://localhost:3000`) |
| `FIREBASE_PROJECT_ID` | Firebase proje ID'si |
| `FIREBASE_CLIENT_EMAIL` | Firebase servis hesabı e-postası |
| `FIREBASE_PRIVATE_KEY` | Firebase servis hesabı özel anahtarı (JSON dosyasındaki `private_key` alanı) |

> **Not:** Klasik Google OAuth2 (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) kullanılmamaktadır. Google ile giriş Firebase Auth üzerinden yapıldığı için bu değişkenlere gerek yoktur. Firebase, Google OAuth2 işlemlerini kendi içinde halleder; bize sadece Firebase Admin SDK bilgileri yeterlidir.

### Frontend (.env)

| Değişken | Açıklama |
|---|---|
| `VITE_API_URL` | Backend API adresi (ör: `http://localhost:4000`) |
| `VITE_FIREBASE_API_KEY` | Firebase Web API anahtarı |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase proje ID'si |
| `VITE_FIREBASE_APP_ID` | Firebase uygulama ID'si |

> **Not:** Vite kullandığımız için frontend ortam değişkenlerinin `VITE_` ön ekiyle başlaması zorunludur. Kodda `import.meta.env.VITE_API_URL` şeklinde erişilir.

### Production Secret Yönetimi

Production ortamında `.env.production` dosyası sunucuda manuel oluşturulur ve asla Git reposuna eklenmez. `.gitignore` dosyasında tüm `.env.*` dosyaları (`.env.example` hariç) engellenmiştir. Gerçek bir deploy senaryosunda bu değerler sunucunun environment variable'larından veya bir secret manager'dan (AWS Secrets Manager, Google Secret Manager vb.) okunmalıdır.

---

## Tamamlanan Seviyeler

### Seviye 1 — Temel Auth Akışı
- Kayıt (Register): E-posta + şifre, bcrypt ile hash'lenerek PostgreSQL'e kaydediliyor
- Giriş (Login): JWT üretilip httpOnly cookie olarak set ediliyor
- Dashboard: `authenticateToken` middleware'i ile korunuyor, token yoksa erişilemiyor
- Çıkış (Logout): Cookie'ler temizleniyor
- Doğrulama: Boş alan, e-posta formatı ve minimum şifre uzunluğu backend'de kontrol ediliyor

### Seviye 2 — Access + Refresh Token & Ortam Farkındalığı (HEDEF)
- Access token (15dk) + Refresh token (7gün) ayrı httpOnly cookie'lerde
- `fetchWithAutoRefresh` helper'ı ile kullanıcı fark etmeden otomatik token yenileme
- Rol bazlı erişim: `user` ve `admin` rolleri, `authorizeRoles` middleware'i ile backend'de kontrol
- CORS + `credentials: 'include'` yapılandırması
- `NODE_ENV`'e göre `secure` ve `sameSite` cookie ayarları değişiyor
- Firebase Auth ile Google girişi (otomatik kayıt + mevcut hesaba giriş + hesap eşleştirme)
- Sequelize migration'ları ile tablo oluşturma (`sequelize-cli db:migrate`)

### Seviye 3 — Production Seviyesi Güvenlik (BONUS) ✅
- Refresh token rotation: Her yenilemede eski token siliniyor, yenisi oluşturuluyor
- Token reuse detection: Kullanılmış token tekrar denenirse tüm oturumlar kapatılıyor
- Tüm cihazlardan çıkış yapma özelliği
- CSRF koruması: `sameSite: 'strict'` cookie yapılandırması
- Rate limiting: Login (15dk/5), Register (1saat/3), Forgot Password (15dk/5)
- E-posta doğrulama akışı (kayıt sonrası doğrulama linki)
- Şifre sıfırlama akışı (token bazlı, 1 saat geçerli)
- `.env.production` dosyası repoda yok, `.gitignore`'da engelli
- Morgan ile yapılandırılmış loglama (şifre/token değerleri `***HIDDEN***` olarak maskeleniyor)

---

## Önemli Tasarım ve Güvenlik Kararları

- **Token Yönetimi:** localStorage yerine httpOnly cookie tercih ettim. localStorage'a JavaScript erişebildiği için XSS saldırılarında token çalınabilir. httpOnly cookie'ye JavaScript erişemez, sadece tarayıcı otomatik olarak isteklere ekler.

- **Refresh Token Rotation:** Refresh token'lar veritabanında saklanıyor. Her yenilemede eski token silinip yenisi oluşturuluyor. Eğer zaten silinmiş bir token tekrar kullanılmaya çalışılırsa (token reuse detection), bu çalınmış token olabilir diye o kullanıcının tüm refresh token'ları silinerek güvenlik sağlanıyor.

- **CSRF Koruması:** Ayrı bir CSRF token mekanizması yerine `sameSite: 'strict'` kullandım. Bu ayar sayesinde cookie sadece aynı origin'den gelen isteklere ekleniyor, farklı sitelerden yapılan sahte isteklere eklenmediği için CSRF saldırıları engellenmiş oluyor.

- **Şifre Güvenliği:** Kullanıcı şifreleri asla düz metin olarak saklanmıyor. `bcrypt` ile 10 round salt ile hash'lenip veritabanına kaydediliyor. Giriş kontrolünde `bcrypt.compare()` kullanılıyor.

- **Veritabanı:** Tüm veritabanı işlemleri Sequelize ORM aracılığıyla yapılıyor. Hiçbir yerde ham SQL string birleştirmesi yok, bu sayede SQL injection'a karşı otomatik koruma sağlanıyor. Tablolar migration dosyalarıyla yönetiliyor.

- **Firebase Tercihi:** Google ile giriş için klasik Passport.js + OAuth2 yerine Firebase Auth kullandım. Firebase, Google OAuth2 altyapısını kendi yönetiyor. Frontend'de `signInWithPopup` ile ID token alınıyor, backend'de `admin.auth().verifyIdToken()` ile doğrulanıyor. Google token asla frontend'de açık tutulmuyor, hemen backend'e iletilip kendi JWT sistemimize dönüştürülüyor.

- **Ortam Ayrımı:** `dotenv` yüklemesi `NODE_ENV`'e göre `.env.development` veya `.env.production` dosyasını seçiyor. Cookie'lerde `secure` flag'i production'da `true`, development'ta `false` olarak ayarlanıyor.

---

## Geliştirme Sürecinde Karşılaştığım Zorluklar

- **Vite geçişi:** Projeyi başta Create React App (CRA) ile kurdum ama sonra Vite'a geçtim. Geçişte en çok takıldığım yer `.js` uzantılı dosyaların Vite'ta JSX parse edememesiydi. Tüm dosyaları `.jsx` olarak yeniden adlandırmam gerekti. Ayrıca environment variable'larda `process.env.REACT_APP_*` yerine `import.meta.env.VITE_*` kullanmak gerektiğini öğrendim.

- **httpOnly Cookie + CORS:** Cookie'lerin frontend-backend arasında gidip gelmesi için hem backend'de `credentials: true` (CORS ayarı), hem frontend'de `credentials: 'include'` (fetch ayarı) olması gerektiğini anlamam biraz zaman aldı. Biri eksik olunca cookie hiç gönderilmiyordu ve hata mesajı çok açıklayıcı değildi.

- **Refresh Token Rotation mantığı:** İlk başta refresh token'ı sadece üretip cookie'ye koydum ama sonra "token çalınırsa ne olacak" sorusunu düşündüm. Token'ları veritabanında tutup her kullanımda eskisini silme ve yenisini oluşturma mantığını kurmak biraz uğraştırdı. Özellikle "token reuse detection" kısmı — yani eski token tekrar kullanılırsa tüm oturumları kapatma — ekstra düşünce gerektirdi.

- **Firebase Private Key:** `.env` dosyasına Firebase private key'i yazarken `\n` karakterlerinin düzgün parse edilmemesi sorunu yaşadım. Çözüm olarak `replace(/\\n/g, '\n')` kullanmam gerekti.

- **Sequelize modelleri ve migration uyumu:** Migration dosyalarıyla oluşturduğum tablolarla Sequelize model tanımlarının birebir eşleşmesi gerekiyordu. `timestamps: false` ayarını unutunca Sequelize tabloda olmayan `createdAt`/`updatedAt` sütunlarını aramaya çalışıp hata verdi.

- **E-posta doğrulama simülasyonu:** Gerçek bir e-posta servisi (SendGrid, Mailgun vs.) entegre etmedim çünkü ücretsiz planları sınırlı ve ilk ödevi için gereksiz karmaşıklık olacaktı. Bunun yerine terminale doğrulama linkini yazdırarak simüle ettim. Gerçek bir projede burada bir mail servisi olmalı.

---

## Kullanılan Teknolojiler

| Katman | Teknoloji |
|---|---|
| Backend | Node.js + Express |
| Frontend | React + Vite + TailwindCSS |
| Veritabanı | PostgreSQL |
| ORM | Sequelize |
| Auth | JWT (httpOnly Cookie) |
| Google Girişi | Firebase Auth |
| Loglama | Morgan |
| Güvenlik | bcrypt, rate-limit, sameSite cookie |

