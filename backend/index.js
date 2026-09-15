// Ortam değişkenlerini yükle
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
require('dotenv').config({ path: envFile });

const express = require('express');
const cors = require('cors');
// Sequelize Modellerini İçeri Aktar
const { sequelize, User, RefreshToken } = require('./models');
const { Op } = require('sequelize');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const morgan = require('morgan');
require('./firebase');
const { getAuth } = require('firebase-admin/auth');

const app = express();

// Hassas verileri maskeleyerek yapısal loglama
morgan.token('body', (req) => {
  const body = { ...req.body };
  if (body.password) body.password = '***HIDDEN***';
  if (body.token) body.token = '***HIDDEN***';
  if (body.newPassword) body.newPassword = '***HIDDEN***';
  if (body.idToken) body.idToken = '***HIDDEN***';
  return JSON.stringify(body);
});
app.use(morgan(':method :url :status :res[content-length] - :response-time ms - Body: :body'));

// Rate limit konfigürasyonları
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Çok fazla giriş denemesi yaptınız, lütfen 15 dakika sonra tekrar deneyin.' }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Çok fazla kayıt isteği gönderdiniz. 1 saat sonra tekrar deneyin.' }
});

const FRONTEND_URL = process.env.FRONTEND_URL;
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Kullanıcı Kayıt Endpoint'i
app.post('/register', registerLimiter, async (req, res) => {
  const { email, password } = req.body;

  // Girdi doğrulama
  if (!email || !password) {
    return res.status(400).json({ error: 'E-posta ve şifre zorunlu.' });
  }
  if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
    return res.status(400).json({ error: 'Geçersiz e-posta.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Şifre 6 karakterden kısa olamaz.' });
  }

  try {
    const checkUser = await User.findOne({ where: { email } });
    if (checkUser) {
      return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    await User.create({
      email,
      password: hashedPassword,
      verification_token: verificationToken,
      is_verified: false,
    });

    // E-posta gönderim simülasyonu
    console.log('\n--- YENİ KAYIT BİLDİRİMİ ---');
    console.log(`E-posta doğrulama linkiniz: http://localhost:${process.env.PORT || 4000}/verify?token=${verificationToken}`);
    console.log('----------------------------\n');

    return res.json({ message: 'Kayıt başarılı! Lütfen terminaldeki linke tıklayarak e-postanızı doğrulayın.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// Kullanıcı Girişi (Login)
app.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'E-posta ve şifre gerekli.' });
  }
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı veya şifre.' });
    }

    // E-posta doğrulama kontrolü
    if (!user.is_verified) {
      return res.status(403).json({ error: 'Lütfen giriş yapmadan önce e-postanızı doğrulayın (Terminaldeki linki kontrol edin).' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı veya şifre.' });
    }

    // Access Token (15m)
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    // Refresh Token (7d)
    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Refresh token'ı veritabanına kaydet
    await RefreshToken.create({ user_id: user.id, token: refreshToken });

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
    };

    // Tokenları HTTP-only cookie olarak ayarla
    res.cookie('accessToken', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000
    });
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({ message: 'Giriş başarılı!' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// Firebase Authentication (Google Girişi)
app.post('/auth/firebase', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'ID Token eksik.' });

  try {
    // Firebase ID Token doğrulama
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const email = decodedToken.email;

    // Kullanıcı varlık kontrolü
    let user = await User.findOne({ where: { email } });

    // Kullanıcı bulunamadıysa yeni hesap oluştur
    if (!user) {
      user = await User.create({
        email,
        password: null,
        role: 'user',
        is_verified: true,
      });
    }

    // Dahili JWT Access ve Refresh Token üretimi
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Refresh token veritabanı kaydı
    await RefreshToken.create({ user_id: user.id, token: refreshToken });

    // Cookie ayarları
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
    };

    // Token çerezlerini ayarla
    res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

    return res.json({ message: 'Firebase ile giriş başarılı.' });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: 'Firebase doğrulaması başarısız.' });
  }
});

// E-posta Doğrulama Endpoint'i
app.get('/verify', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Token eksik.');

  try {
    const user = await User.findOne({ where: { verification_token: token } });
    if (!user) return res.status(400).send('Geçersiz doğrulama linki.');

    // Hesabı doğrulanmış olarak güncelle ve token'ı temizle
    await user.update({ is_verified: true, verification_token: null });

    res.send('<h1 style="color: green; text-align: center; margin-top: 50px;">Hesabınız başarıyla doğrulandı! Sekmeyi kapatıp giriş yapabilirsiniz.</h1>');
  } catch (err) {
    res.status(500).send('Sunucu hatası.');
  }
});

// Refresh Token Endpoint
app.post('/refresh-token', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token eksik.' });
  }
  try {
    const userInfo = jwt.verify(refreshToken, process.env.JWT_SECRET);

    // Token veritabanı kontrolü
    const dbToken = await RefreshToken.findOne({ where: { token: refreshToken } });
    if (!dbToken) {
      // Token Reuse Detection (Çalınma Tespiti): Güvenlik için tüm oturumları sonlandır
      await RefreshToken.destroy({ where: { user_id: userInfo.userId } });
      return res.status(403).json({ error: 'Güvenlik ihlali tespit edildi. Lütfen tekrar giriş yapın.' });
    }

    // Yeni access ve refresh token üretimi
    const newAccessToken = jwt.sign(
      { userId: userInfo.userId, email: userInfo.email, role: userInfo.role || 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    const newRefreshToken = jwt.sign(
      { userId: userInfo.userId, email: userInfo.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Refresh token rotasyonu
    await dbToken.destroy();
    await RefreshToken.create({ user_id: userInfo.userId, token: newRefreshToken });

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
    };

    res.cookie('accessToken', newAccessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', newRefreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

    return res.json({ message: 'Tokenlar yenilendi.' });
  } catch (err) {
    // Süresi dolan token'ı temizle
    if (refreshToken) {
      await RefreshToken.destroy({ where: { token: refreshToken } }).catch(() => {});
    }
    return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş refresh token.' });
  }
});

// Token Doğrulama Middleware'i
function authenticateToken(req, res, next) {
  const token = req.cookies.accessToken;
  if (!token) {
    return res.status(401).json({ error: 'Giriş yapmalısınız.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş oturum.' });
  }
}

// Rol Bazlı Yetkilendirme Middleware'i
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Giriş yapmalısınız.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bu işlemi yapmak için yetkiniz yok.' });
    }
    next();
  };
}

// Korumalı Dashboard Route
app.get('/dashboard', authenticateToken, async (req, res) => {
  res.json({
    message: `Merhaba ${req.user.email}, Dashboard'a hoşgeldin!`,
    user: req.user
  });
});

// Admin Yetkili Route
app.get('/admin-only', authenticateToken, authorizeRoles('admin'), (req, res) => {
  res.json({ message: 'Bu alan sadece adminlere açık.' });
});

// Logout Endpoint
app.post('/logout', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) {
    await RefreshToken.destroy({ where: { token: refreshToken } }).catch(() => {});
  }
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  return res.json({ message: 'Çıkış başarılı!' });
});

// Tüm Oturumları Kapatma (Revocation)
app.post('/logout-all', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  await RefreshToken.destroy({ where: { user_id: userId } });
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  return res.json({ message: 'Tüm cihazlardan çıkış yapıldı!' });
});

// Veritabanı Bağlantı Testi
app.get('/dbtest', async (req, res) => {
  try {
    const result = await sequelize.query('SELECT NOW()');
    res.json(result[0]); // Sequelize array array [results, metadata] döner
  } catch (err) {
    res.status(500).json({ error: 'DB bağlantı hatası' });
  }
});

// Şifre Sıfırlama İsteği (Forgot Password)
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Çok fazla deneme yaptınız. 15 dakika sonra tekrar deneyin.' }
});

app.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'E-posta gerekli.' });

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    // Rastgele token üret ve 1 saat geçerlilik süresi ver
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expireDate = new Date(Date.now() + 3600000);

    await user.update({
      reset_password_token: resetToken,
      reset_password_expires: expireDate,
    });

    // E-posta gönderimi simülasyonu
    console.log('\n--- ŞİFRE SIFIRLAMA İSTEĞİ ---');
    console.log(`Şifrenizi sıfırlamak için linkiniz: ${process.env.FRONTEND_URL}?resetToken=${resetToken}`);
    console.log('------------------------------\n');

    return res.json({ message: 'Şifre sıfırlama bağlantısı terminale (veya e-postanıza) gönderildi.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// Şifre Yenileme (Reset Password)
app.post('/reset-password', loginLimiter, async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token ve yeni şifre gerekli.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });

  try {
    const user = await User.findOne({
      where: {
        reset_password_token: token,
        reset_password_expires: {
          [Op.gt]: new Date()
        }
      }
    });

    if (!user) return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş token.' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await user.update({
      password: hashedPassword,
      reset_password_token: null,
      reset_password_expires: null
    });

    return res.json({ message: 'Şifreniz başarıyla güncellendi!' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// Veritabanı Senkronizasyonu ve Sunucu Başlatma
const PORT = process.env.PORT || 4000;
sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log('Sunucu ve Veritabanı (Sequelize) çalışıyor: http://localhost:' + PORT);
  });
}).catch(err => {
  console.error('Veritabanı bağlantı hatası:', err);
});