const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User } = require('../models');
const env = require('../config/env');
const firebase = require('../config/firebase');
const tokenUtil = require('../utils/token');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');
const {
  assertValidCredentials,
  assertValidPassword,
  assertValidEmail,
  normalizeEmail,
} = require('../utils/validation');
const sessionService = require('../services/session.service');
const profileService = require('../services/profile.service');
const mailer = require('../services/mailer.service');

// 10 yaygın varsayılan ama donanım hızlandıkça yetersiz kalıyor.
const BCRYPT_ROUNDS = 12;
// Sıfırlama daha kısa: ele geçirilmiş bir posta kutusunda daha tehlikeli.
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

// Kullanıcı bulunamadığında da karşılaştırma yapılsın diye. Hemen dönseydik
// cevap süresi hangi e-postaların kayıtlı olduğunu ele verirdi.
const DUMMY_HASH = bcrypt.hashSync('timing-attack-placeholder', BCRYPT_ROUNDS);

// GET /api/auth/csrf
// Cookie varsa yenisi üretilmiyor: açık sekmelerin elindeki değer geçersiz olmasın.
async function getCsrfToken(req, res) {
  const csrfToken = req.cookies?.[tokenUtil.CSRF_COOKIE] || sessionService.issueCsrfToken(res);
  res.json({ csrfToken });
}

// POST /api/auth/register
// Kayıt sonrası oturum açılmıyor; hesap e-posta doğrulanana kadar giriş yapamaz.
async function register(req, res) {
  const { email, password } = assertValidCredentials(req.body || {});

  // Yarış durumunda iki istek birden geçebilir; asıl güvence tablodaki
  // unique kısıtı. Buradaki kontrol anlaşılır mesaj için.
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw ApiError.conflict('Bu e-posta adresi zaten kayıtlı.');
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const verification = tokenUtil.generateOpaqueToken();

  await User.create({
    email,
    password: hashedPassword,
    // Rol istekten alınmıyor: gövdeye role yazan herkes yönetici olurdu.
    role: 'user',
    isVerified: false,
    // Ham token e-postaya, özeti veritabanına.
    verificationToken: verification.hash,
    verificationTokenExpires: new Date(Date.now() + VERIFICATION_TTL_MS),
  });

  mailer.sendVerificationEmail(email, verification.token);
  logger.info('Yeni kullanıcı kaydı oluşturuldu.', { email });

  res.status(201).json({
    message: 'Kayıt başarılı. E-postanıza gönderilen bağlantı ile hesabınızı doğrulayın.',
  });
}

// GET /api/auth/verify-email?token=...
// Kullanıcı buraya e-postadaki bağlantıdan geliyor, bu yüzden JSON değil
// yönlendirme dönülüyor. Geçersiz ve süresi dolmuş token aynı cevabı alıyor.
async function verifyEmail(req, res) {
  // Query parametresi dizi de olabilir (?token=a&token=b).
  const rawToken = typeof req.query.token === 'string' ? req.query.token : '';
  const redirect = (status) => res.redirect(`${env.frontendUrl}/login?verified=${status}`);

  if (!rawToken) {
    return redirect('invalid');
  }

  // withSecrets gerekli: verificationToken varsayılan kapsamda seçilmiyor.
  const user = await User.scope('withSecrets').findOne({
    where: {
      verificationToken: tokenUtil.hashToken(rawToken),
      verificationTokenExpires: { [Op.gt]: new Date() },
    },
  });

  if (!user) {
    return redirect('invalid');
  }

  // Token tek kullanımlık.
  await user.update({
    isVerified: true,
    verificationToken: null,
    verificationTokenExpires: null,
  });

  logger.info('E-posta doğrulandı.', { userId: user.id });
  return redirect('success');
}

// POST /api/auth/login
// Cevap gövdesinde token yok; token'lar httpOnly cookie ile taşınıyor.
async function login(req, res) {
  // Girişte şifre politikası uygulanmıyor: kurallar sıkılaştığında eski
  // şifreli kullanıcılar kilitlenmesin.
  const { email, password } = assertValidCredentials(req.body || {}, {
    checkPasswordStrength: false,
  });

  const user = await User.scope('withSecrets').findOne({ where: { email } });
  const passwordMatches = await bcrypt.compare(password, user?.password || DUMMY_HASH);

  // Üç durum da aynı mesajı alıyor (kullanıcı yok / şifresi yok / şifre yanlış):
  // ayırmak geçerli adreslerin listelenmesine yarardı.
  if (!user || !user.password || !passwordMatches) {
    throw ApiError.unauthorized('E-posta veya şifre hatalı.');
  }

  // Doğrulama kontrolü bilerek şifreden sonra: önce olsaydı şifreyi bilmeyen
  // biri de adresin kayıtlı olduğunu öğrenirdi.
  if (!user.isVerified) {
    throw ApiError.forbidden(
      'Giriş yapmadan önce e-posta adresinizi doğrulayın.',
      { code: 'EMAIL_NOT_VERIFIED' }
    );
  }

  await sessionService.createSession(res, user);
  logger.info('Giriş yapıldı.', { userId: user.id });

  res.json({ message: 'Giriş başarılı.', user: user.toPublicJSON() });
}

// POST /api/auth/google
// Giriş ve kayıt aynı uçtan. Firebase token'ı yalnızca kimliği kanıtlıyor;
// oturum kendi httpOnly cookie'lerimizle kuruluyor.
async function loginWithGoogle(req, res) {
  if (!firebase.isEnabled()) {
    throw ApiError.serviceUnavailable('Google ile giriş bu ortamda yapılandırılmamış.');
  }

  const { idToken } = req.body || {};
  if (!idToken || typeof idToken !== 'string') {
    throw ApiError.badRequest('ID token eksik.');
  }

  let decoded;
  try {
    decoded = await firebase.verifyIdToken(idToken);
  } catch (err) {
    // Sebep loglanıyor, kullanıcıya genel mesaj dönüyor.
    logger.warn('Firebase ID token doğrulanamadı.', { reason: err.message });
    throw ApiError.unauthorized('Google doğrulaması başarısız.');
  }

  const email = assertValidEmail(decoded.email);

  // Hesap ele geçirmeye karşı kritik: doğrulanmamış adresle Google hesabı
  // açıp aşağıdaki eşleştirmeyle gerçek hesaba bağlanmak mümkün olurdu.
  if (!decoded.email_verified) {
    throw ApiError.forbidden('Google hesabınızın e-posta adresi doğrulanmamış.');
  }

  // Her girişte tazeleniyor.
  const profile = {
    displayName: decoded.name || null,
    photoUrl: decoded.picture || null,
  };

  // Yalnızca alan adları loglanıyor; değerler kişisel veri.
  logger.debug('Firebase token claim\'leri', {
    claims: Object.keys(decoded).join(','),
    hasName: Boolean(decoded.name),
    hasPicture: Boolean(decoded.picture),
  });

  // Eşleştirme sırası: önce googleUid (e-posta değişse de aynı hesap),
  // sonra e-posta (mevcut hesaba bağlan), yoksa yeni kayıt.
  let user = await User.findOne({ where: { googleUid: decoded.uid } });

  if (user) {
    await user.update(profile);
  } else {
    user = await User.findOne({ where: { email } });
    if (user) {
      // Adresin sahipliğini Google doğruladı, ikinci doğrulama gereksiz.
      await user.update({ googleUid: decoded.uid, isVerified: true, ...profile });
      logger.info('Mevcut hesaba Google kimliği bağlandı.', { userId: user.id });
    } else {
      user = await User.create({
        email,
        // Şifresiz hesap; kullanıcı sonradan belirleyebiliyor.
        password: null,
        role: 'user',
        googleUid: decoded.uid,
        isVerified: true,
        ...profile,
      });
      logger.info('Google ile yeni kullanıcı oluşturuldu.', { userId: user.id });
    }
  }

  await sessionService.createSession(res, user);
  res.json({ message: 'Google ile giriş başarılı.', user: user.toPublicJSON() });
}

// POST /api/auth/refresh
// Asıl rotasyon mantığı session.service'te.
async function refresh(req, res) {
  const presentedToken = req.cookies?.[tokenUtil.REFRESH_COOKIE];

  try {
    const user = await sessionService.rotateSession(res, presentedToken);
    res.json({ message: 'Oturum yenilendi.', user: user.toPublicJSON() });
  } catch (err) {
    // Temizlenmezse istemci aynı ölü token'la sonsuz 401 döngüsüne girer.
    // 500'de temizlemiyoruz: geçici sunucu hatası olabilir.
    if (err instanceof ApiError && err.statusCode !== 500) {
      tokenUtil.clearAuthCookies(res);
    }
    throw err;
  }
}

// POST /api/auth/logout
// Sunucuda iptal şart; sadece cookie silmek kopyalanmış token'ı geçerli bırakırdı.
async function logout(req, res) {
  await sessionService.revokeSession(req.cookies?.[tokenUtil.REFRESH_COOKIE]);
  tokenUtil.clearAuthCookies(res);
  res.json({ message: 'Çıkış yapıldı.' });
}

// POST /api/auth/logout-all
// Kimlik iki kaynaktan çözülüyor: access token yoksa refresh token'dan.
// Bu özelliğe tam da access token'ın süresi dolduğunda ihtiyaç duyuluyor.
async function logoutAll(req, res) {
  let userId = req.user?.id;

  if (!userId) {
    const presentedToken = req.cookies?.[tokenUtil.REFRESH_COOKIE];
    if (presentedToken) {
      try {
        userId = Number(tokenUtil.verifyRefreshToken(presentedToken).sub);
      } catch {
        userId = undefined;
      }
    }
  }

  if (!userId) {
    // Kimlik çözülemese de cookie'ler temizleniyor: kullanıcı zaten çıkmak istiyor.
    tokenUtil.clearAuthCookies(res);
    throw ApiError.unauthorized('Giriş yapmalısınız.');
  }

  await sessionService.revokeAllForUser(userId);
  tokenUtil.clearAuthCookies(res);
  logger.info('Tüm oturumlar kapatıldı.', { userId });

  res.json({ message: 'Tüm cihazlardan çıkış yapıldı.' });
}

// POST /api/auth/forgot-password
// Cevap her durumda aynı: aksi halde bu uç e-posta doğrulama aracına dönerdi.
async function forgotPassword(req, res) {
  const email = assertValidEmail((req.body || {}).email);
  // withSecrets gerekli: password varsayılan kapsamda seçilmiyor.
  const user = await User.scope('withSecrets').findOne({ where: { email } });

  // Şifresiz (yalnızca Google) hesaba bağlantı gönderilmiyor.
  if (user && user.password) {
    const reset = tokenUtil.generateOpaqueToken();
    await user.update({
      resetPasswordToken: reset.hash,
      resetPasswordExpires: new Date(Date.now() + RESET_TTL_MS),
    });
    mailer.sendPasswordResetEmail(email, reset.token);
    logger.info('Şifre sıfırlama isteği oluşturuldu.', { userId: user.id });
  }

  res.json({
    message: 'Bu e-posta adresi kayıtlıysa şifre sıfırlama bağlantısı gönderildi.',
  });
}

// POST /api/auth/reset-password
// Sıfırlama genelde "hesabım ele geçirildi" şüphesiyle yapılıyor; saldırganın
// açık oturumu kalırsa işlemin anlamı olmaz, bu yüzden hepsi kapatılıyor.
async function resetPassword(req, res) {
  const { token, newPassword } = req.body || {};
  if (!token || typeof token !== 'string') {
    throw ApiError.badRequest('Sıfırlama bağlantısı geçersiz.');
  }
  assertValidPassword(newPassword);

  const user = await User.scope('withSecrets').findOne({
    where: {
      resetPasswordToken: tokenUtil.hashToken(token),
      resetPasswordExpires: { [Op.gt]: new Date() },
    },
  });

  if (!user) {
    throw ApiError.badRequest('Sıfırlama bağlantısı geçersiz veya süresi dolmuş.');
  }

  await user.update({
    password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
    // Tek kullanımlık.
    resetPasswordToken: null,
    resetPasswordExpires: null,
  });

  await sessionService.revokeAllForUser(user.id);
  tokenUtil.clearAuthCookies(res);
  logger.info('Şifre sıfırlandı, tüm oturumlar kapatıldı.', { userId: user.id });

  res.json({ message: 'Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.' });
}

// POST /api/auth/set-password
// Hem şifresiz hesaba şifre ekler hem mevcut şifreyi değiştirir. Şifre varsa
// mevcut şifre zorunlu: ele geçirilmiş bir access token'la hesap devralınmasın.
async function setPassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  assertValidPassword(newPassword);

  const user = await User.scope('withSecrets').findByPk(req.user.id);
  if (!user) {
    throw ApiError.unauthorized('Kullanıcı bulunamadı.');
  }

  const alreadyHasPassword = Boolean(user.password);

  if (alreadyHasPassword) {
    if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
      throw ApiError.badRequest('Mevcut şifrenizi girmelisiniz.', {
        code: 'CURRENT_PASSWORD_REQUIRED',
      });
    }
    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      throw ApiError.unauthorized('Mevcut şifre hatalı.');
    }
    if (currentPassword === newPassword) {
      throw ApiError.badRequest('Yeni şifre eskisiyle aynı olamaz.');
    }
  }

  await user.update({ password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) });

  // Diğer cihazlar düşüyor, bu cihaz için yeni oturum açılıyor: kullanıcı
  // kendi şifresini değiştirdiği için giriş ekranına atılmasın.
  await sessionService.revokeAllForUser(user.id);
  await sessionService.createSession(res, user);

  logger.info(alreadyHasPassword ? 'Şifre değiştirildi.' : 'Şifre belirlendi.', {
    userId: user.id,
  });

  res.json({
    message: alreadyHasPassword
      ? 'Şifreniz güncellendi. Diğer cihazlardaki oturumlar kapatıldı.'
      : 'Şifreniz belirlendi. Artık e-posta ve şifreyle de giriş yapabilirsiniz.',
    user: user.toPublicJSON(),
  });
}

// POST /api/auth/deactivate — soft delete.
// Onay olarak e-posta isteniyor; Google hesaplarında şifre olmayabiliyor.
async function deactivateAccount(req, res) {
  const { confirmEmail } = req.body || {};

  const user = await User.findByPk(req.user.id);
  if (!user) {
    throw ApiError.unauthorized('Kullanıcı bulunamadı.');
  }

  if (normalizeEmail(confirmEmail) !== user.email) {
    throw ApiError.badRequest(
      'Onaylamak için hesabınızın e-posta adresini doğru yazmalısınız.',
      { fields: { confirmEmail: 'E-posta adresi eşleşmiyor.' } }
    );
  }

  if (!user.isActive) {
    throw ApiError.conflict('Hesabınız zaten devre dışı.');
  }

  await user.update({ isActive: false });

  // Diğer cihazlar kapatılıyor, bu cihaz açık kalıyor ki kullanıcı hemen
  // geri dönmek isterse yeniden giriş yapmasın.
  await sessionService.revokeAllForUser(user.id);
  await sessionService.createSession(res, user);

  logger.info('Hesap devre dışı bırakıldı.', { userId: user.id });

  res.json({
    message: 'Hesabınız devre dışı bırakıldı. İstediğiniz zaman yeniden etkinleştirebilirsiniz.',
    user: user.toPublicJSON(),
  });
}

// POST /api/auth/delete-account — hard delete.
// Bağlı profil ve refresh token kayıtları ON DELETE CASCADE ile siliniyor.
// Geri alınamaz olduğu için e-postanın yanında ayrıca onay bayrağı isteniyor.
// DELETE yerine POST: gövdeli DELETE bazı proxy'lerde gövdeyi kaybediyor.
async function deleteAccount(req, res) {
  const { confirmEmail, acknowledged } = req.body || {};

  const user = await User.findByPk(req.user.id);
  if (!user) {
    throw ApiError.unauthorized('Kullanıcı bulunamadı.');
  }

  const errors = {};
  if (normalizeEmail(confirmEmail) !== user.email) {
    errors.confirmEmail = 'E-posta adresi eşleşmiyor.';
  }
  if (acknowledged !== true) {
    errors.acknowledged = 'Silme işlemini onaylamalısınız.';
  }
  if (Object.keys(errors).length > 0) {
    throw ApiError.badRequest('Silme işlemi onaylanmadı.', { fields: errors });
  }

  // destroy sonrası kayıt yok, önce saklanıyor.
  const userId = user.id;
  // Profil satırını CASCADE düşürüyor ama buluttaki fotoğrafı kimse silmiyor.
  // Kimlik silmeden önce okunmak zorunda: sonrasında ulaşılacak kayıt kalmıyor.
  const photoPublicId = await profileService.getPhotoPublicId(userId);

  await user.destroy();
  // Dosya en sonda: dosyanın silinip hesabın silinememesindense tersi yeğ.
  await profileService.deleteStoredPhoto(photoPublicId);
  tokenUtil.clearAuthCookies(res);

  logger.info('Hesap kalıcı olarak silindi.', { userId });

  res.json({ message: 'Hesabınız ve tüm verileriniz kalıcı olarak silindi.' });
}

// POST /api/auth/reactivate
async function reactivateAccount(req, res) {
  const user = await User.findByPk(req.user.id);
  if (!user) {
    throw ApiError.unauthorized('Kullanıcı bulunamadı.');
  }

  if (user.isActive) {
    throw ApiError.conflict('Hesabınız zaten etkin.');
  }

  await user.update({ isActive: true });
  logger.info('Hesap yeniden etkinleştirildi.', { userId: user.id });

  res.json({
    message: 'Hesabınız yeniden etkinleştirildi.',
    user: user.toPublicJSON(),
  });
}

// GET /api/auth/me
// Kullanıcı token'dan değil veritabanından okunuyor: rol veya durum token
// üretildikten sonra değişmiş olabilir.
async function me(req, res) {
  const user = await User.findByPk(req.user.id);
  if (!user) {
    throw ApiError.unauthorized('Kullanıcı bulunamadı.');
  }

  // Avatar iki kaynaktan gelebiliyor. Öncelik kullanıcının yüklediğinde:
  // Google'dan gelen her girişte tazelendiği için oraya yazılamıyor.
  const profile = await profileService.getProfile(user.id);

  res.json({
    user: {
      ...user.toPublicJSON(),
      photoUrl: profile?.photoUrl || user.photoUrl,
    },
  });
}

module.exports = {
  getCsrfToken,
  register,
  verifyEmail,
  login,
  loginWithGoogle,
  refresh,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
  setPassword,
  deactivateAccount,
  reactivateAccount,
  deleteAccount,
  me,
};
