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
} = require('../utils/validation');
const sessionService = require('../services/session.service');
const mailer = require('../services/mailer.service');

const BCRYPT_ROUNDS = 12;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

// Kullanıcı bulunamadığında da compare çalıştırmak için: zamanlama farkını kapatır.
const DUMMY_HASH = bcrypt.hashSync('timing-attack-placeholder', BCRYPT_ROUNDS);

// GET /api/auth/csrf
async function getCsrfToken(req, res) {
  const csrfToken = req.cookies?.[tokenUtil.CSRF_COOKIE] || sessionService.issueCsrfToken(res);
  res.json({ csrfToken });
}

// POST /api/auth/register
async function register(req, res) {
  const { email, password } = assertValidCredentials(req.body || {});

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw ApiError.conflict('Bu e-posta adresi zaten kayıtlı.');
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const verification = tokenUtil.generateOpaqueToken();

  await User.create({
    email,
    password: hashedPassword,
    role: 'user',
    isVerified: false,
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
async function verifyEmail(req, res) {
  const rawToken = typeof req.query.token === 'string' ? req.query.token : '';
  const redirect = (status) => res.redirect(`${env.frontendUrl}/login?verified=${status}`);

  if (!rawToken) {
    return redirect('invalid');
  }

  const user = await User.scope('withSecrets').findOne({
    where: {
      verificationToken: tokenUtil.hashToken(rawToken),
      verificationTokenExpires: { [Op.gt]: new Date() },
    },
  });

  if (!user) {
    return redirect('invalid');
  }

  await user.update({
    isVerified: true,
    verificationToken: null,
    verificationTokenExpires: null,
  });

  logger.info('E-posta doğrulandı.', { userId: user.id });
  return redirect('success');
}

// POST /api/auth/login
async function login(req, res) {
  // Girişte şifre politikası uygulanmaz, sadece format kontrolü.
  const { email, password } = assertValidCredentials(req.body || {}, {
    checkPasswordStrength: false,
  });

  const user = await User.scope('withSecrets').findOne({ where: { email } });
  const passwordMatches = await bcrypt.compare(password, user?.password || DUMMY_HASH);

  if (!user || !user.password || !passwordMatches) {
    throw ApiError.unauthorized('E-posta veya şifre hatalı.');
  }

  // Doğrulama durumu ancak şifre doğrulandıktan sonra açıklanır.
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

/**
 * POST /api/auth/google
 * Firebase ID token'ı burada doğrulanır; oturum kendi httpOnly cookie'lerimizle
 * kurulur, Firebase token'ı frontend'de saklanmaz.
 */
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
    logger.warn('Firebase ID token doğrulanamadı.', { reason: err.message });
    throw ApiError.unauthorized('Google doğrulaması başarısız.');
  }

  const email = assertValidEmail(decoded.email);

  // Doğrulanmamış e-posta, aynı adresli mevcut hesabı ele geçirmek için kullanılabilir.
  if (!decoded.email_verified) {
    throw ApiError.forbidden('Google hesabınızın e-posta adresi doğrulanmamış.');
  }

  // Profil bilgisi token'dan gelir ve her girişte tazelenir; kullanıcı Google
  // tarafında adını/fotoğrafını değiştirirse burası da güncellenir.
  const profile = {
    displayName: decoded.name || null,
    photoUrl: decoded.picture || null,
  };

  // Hangi claim'lerin geldiğini görmek için (yalnızca alan adları, değerler değil).
  logger.debug('Firebase token claim\'leri', {
    claims: Object.keys(decoded).join(','),
    hasName: Boolean(decoded.name),
    hasPicture: Boolean(decoded.picture),
  });

  // Önce sağlayıcı kimliği, sonra e-posta: aynı e-posta için ikinci kayıt oluşmaz.
  let user = await User.findOne({ where: { googleUid: decoded.uid } });

  if (user) {
    await user.update(profile);
  } else {
    user = await User.findOne({ where: { email } });
    if (user) {
      await user.update({ googleUid: decoded.uid, isVerified: true, ...profile });
      logger.info('Mevcut hesaba Google kimliği bağlandı.', { userId: user.id });
    } else {
      user = await User.create({
        email,
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
async function refresh(req, res) {
  const presentedToken = req.cookies?.[tokenUtil.REFRESH_COOKIE];

  try {
    const user = await sessionService.rotateSession(res, presentedToken);
    res.json({ message: 'Oturum yenilendi.', user: user.toPublicJSON() });
  } catch (err) {
    // Oturum yenilenemiyorsa istemcide geçersiz cookie kalmasın.
    if (err instanceof ApiError && err.statusCode !== 500) {
      tokenUtil.clearAuthCookies(res);
    }
    throw err;
  }
}

// POST /api/auth/logout
async function logout(req, res) {
  await sessionService.revokeSession(req.cookies?.[tokenUtil.REFRESH_COOKIE]);
  tokenUtil.clearAuthCookies(res);
  res.json({ message: 'Çıkış yapıldı.' });
}

/**
 * POST /api/auth/logout-all
 * Access token süresi dolmuşken de çalışmalı; bu yüzden geçerli bir refresh
 * token da kimlik kanıtı olarak kabul edilir.
 */
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
    tokenUtil.clearAuthCookies(res);
    throw ApiError.unauthorized('Giriş yapmalısınız.');
  }

  await sessionService.revokeAllForUser(userId);
  tokenUtil.clearAuthCookies(res);
  logger.info('Tüm oturumlar kapatıldı.', { userId });

  res.json({ message: 'Tüm cihazlardan çıkış yapıldı.' });
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res) {
  const email = assertValidEmail((req.body || {}).email);
  // withSecrets gerekli: varsayılan scope password alanını seçmiyor.
  const user = await User.scope('withSecrets').findOne({ where: { email } });

  // Hesabın varlığı sızdırılmaz; cevap her durumda aynı.
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
    resetPasswordToken: null,
    resetPasswordExpires: null,
  });

  // Şifre değişti: çalınmış olabilecek tüm oturumlar düşürülür.
  await sessionService.revokeAllForUser(user.id);
  tokenUtil.clearAuthCookies(res);
  logger.info('Şifre sıfırlandı, tüm oturumlar kapatıldı.', { userId: user.id });

  res.json({ message: 'Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.' });
}

/**
 * POST /api/auth/set-password
 *
 * Google ile açılmış hesaplara şifre ekler, şifresi olanlarda değiştirir.
 * Şifre zaten varsa mevcut şifre zorunludur: aksi halde ele geçirilmiş bir
 * access token'la şifre değiştirilip hesap tamamen devralınabilirdi.
 */
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

  // Kimlik bilgisi değişti: diğer cihazlardaki oturumlar düşürülür, bu cihaz
  // için yeni bir oturum açılır (kullanıcı kendini dışarı atmasın).
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

// GET /api/auth/me
async function me(req, res) {
  const user = await User.findByPk(req.user.id);
  if (!user) {
    throw ApiError.unauthorized('Kullanıcı bulunamadı.');
  }
  res.json({ user: user.toPublicJSON() });
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
  me,
};
