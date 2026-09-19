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

/**
 * Kimlik doğrulama uçlarının iş mantığı.
 *
 * Controller'ların görevi: girdiyi doğrulamak, iş kuralını uygulamak ve cevabı
 * hazırlamak. Oturumun teknik kurulumu (token üretimi, cookie, veritabanı
 * kaydı) session.service'e, doğrulama kuralları utils/validation'a bırakıldı.
 *
 * Hatalar res.status(...) ile değil ApiError fırlatılarak bildiriliyor;
 * cevabın biçimini tek bir middleware belirlesin diye.
 */

// bcrypt maliyet katsayısı. 10 yaygın varsayılan ama donanım hızlandıkça
// yetersiz kalıyor; 12, günümüz sunucusunda hash başına ~250 ms demek —
// kullanıcı fark etmez, kaba kuvvet deneyen için ciddi bir maliyet.
const BCRYPT_ROUNDS = 12;
// Doğrulama bağlantısı 24 saat, sıfırlama 1 saat geçerli. Sıfırlamanın daha
// kısa olmasının sebebi: ele geçirilmiş bir posta kutusunda daha tehlikeli.
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

// Kullanıcı bulunamadığında karşılaştırılacak sahte hash.
// Kayıt yoksa hemen dönseydik cevap belirgin şekilde daha hızlı gelirdi ve
// saldırgan bu süre farkından hangi e-postaların kayıtlı olduğunu çıkarabilirdi.
// Sahte hash ile karşılaştırma yaparak iki durumu da aynı süreye yaklaştırıyoruz.
const DUMMY_HASH = bcrypt.hashSync('timing-attack-placeholder', BCRYPT_ROUNDS);

/**
 * GET /api/auth/csrf
 *
 * Frontend'in durum değiştiren ilk isteğinden önce çağırdığı uç. Cookie zaten
 * varsa yenisi üretilmiyor: her çağrıda token değiştirmek, aynı anda açık
 * sekmelerin elindeki değeri geçersiz kılardı.
 *
 * @returns {{csrfToken: string}}
 */
async function getCsrfToken(req, res) {
  const csrfToken = req.cookies?.[tokenUtil.CSRF_COOKIE] || sessionService.issueCsrfToken(res);
  res.json({ csrfToken });
}

/**
 * POST /api/auth/register
 * Gövde: { email, password }
 *
 * Yeni hesap açar ve doğrulama bağlantısı gönderir. Kayıt sonrası oturum
 * AÇILMIYOR: hesap e-posta doğrulanana kadar giriş yapamaz. Aksi halde
 * başkasının adresiyle hesap açıp o adresi kullanıyormuş gibi görünmek mümkün olurdu.
 *
 * @returns 201 ve bilgilendirme mesajı
 */
async function register(req, res) {
  const { email, password } = assertValidCredentials(req.body || {});

  // Bu kontrol kullanıcıya anlaşılır bir mesaj vermek için. Yarış durumunda
  // iki istek birden geçebilir; asıl güvence tablodaki unique kısıtı, o da
  // 409'a dönüştürülüyor (bkz. error.middleware.js).
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw ApiError.conflict('Bu e-posta adresi zaten kayıtlı.');
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const verification = tokenUtil.generateOpaqueToken();

  await User.create({
    email,
    password: hashedPassword,
    // Rol istekten alınmıyor. Alınsaydı gövdeye role: 'admin' yazan herkes
    // yönetici olurdu; yetki yükseltme ayrı ve bilinçli bir işlem olmalı.
    role: 'user',
    isVerified: false,
    // Token'ın ham hali e-postaya, yalnızca özeti veritabanına gidiyor.
    verificationToken: verification.hash,
    verificationTokenExpires: new Date(Date.now() + VERIFICATION_TTL_MS),
  });

  mailer.sendVerificationEmail(email, verification.token);
  logger.info('Yeni kullanıcı kaydı oluşturuldu.', { email });

  res.status(201).json({
    message: 'Kayıt başarılı. E-postanıza gönderilen bağlantı ile hesabınızı doğrulayın.',
  });
}

/**
 * GET /api/auth/verify-email?token=...
 *
 * Kullanıcı bu adrese e-postadaki bağlantıdan geliyor, yani tarayıcı doğrudan
 * gezinme yapıyor. Bu yüzden JSON değil yönlendirme dönülüyor; sonuç frontend'e
 * query parametresiyle bildiriliyor ve orada mesaja çevriliyor.
 *
 * Geçersiz token ile süresi dolmuş token aynı cevabı alıyor: ayırmak,
 * saldırgana hangi token'ların bir zamanlar geçerli olduğunu söylerdi.
 */
async function verifyEmail(req, res) {
  // Query parametresi dizi de olabilir (?token=a&token=b); tip kontrolü
  // yapılmazsa hashToken'a nesne gidip beklenmedik hata üretir.
  const rawToken = typeof req.query.token === 'string' ? req.query.token : '';
  const redirect = (status) => res.redirect(`${env.frontendUrl}/login?verified=${status}`);

  if (!rawToken) {
    return redirect('invalid');
  }

  // Sorgu doğrudan özet üzerinden yapılıyor. Kullanıcıyı bulup sonra
  // karşılaştırmak yerine tek sorguda eşleştirmek hem daha basit hem de
  // süre kontrolünü aynı yerde tutuyor. withSecrets gerekli, çünkü
  // verificationToken varsayılan kapsamda seçilmiyor.
  const user = await User.scope('withSecrets').findOne({
    where: {
      verificationToken: tokenUtil.hashToken(rawToken),
      verificationTokenExpires: { [Op.gt]: new Date() },
    },
  });

  if (!user) {
    return redirect('invalid');
  }

  // Token kullanıldıktan sonra temizleniyor: tek kullanımlık olması,
  // bağlantının e-posta kutusundan ele geçirilmesi durumunda önemli.
  await user.update({
    isVerified: true,
    verificationToken: null,
    verificationTokenExpires: null,
  });

  logger.info('E-posta doğrulandı.', { userId: user.id });
  return redirect('success');
}

/**
 * POST /api/auth/login
 * Gövde: { email, password }
 *
 * Başarılı olursa access + refresh cookie'leri yazılır. Cevap gövdesinde
 * token YOK; istemcinin token'a erişmesine gerek olmadığı gibi, erişebilmesi
 * httpOnly tercihini boşa çıkarırdı.
 *
 * @returns {{message: string, user: object}}
 */
async function login(req, res) {
  // Girişte şifre politikası (uzunluk vb.) uygulanmıyor, yalnızca alanın dolu
  // olduğuna bakılıyor. Kurallar sonradan sıkılaştırıldığında eski şifreli
  // kullanıcıların kilitlenmemesi için.
  const { email, password } = assertValidCredentials(req.body || {}, {
    checkPasswordStrength: false,
  });

  const user = await User.scope('withSecrets').findOne({ where: { email } });
  // compare, kullanıcı bulunamasa bile çalıştırılıyor (DUMMY_HASH ile):
  // cevap süresinin e-postanın kayıtlı olup olmadığını ele vermemesi için.
  const passwordMatches = await bcrypt.compare(password, user?.password || DUMMY_HASH);

  // Üç durum da aynı mesajı alıyor: kullanıcı yok, şifresi yok (Google hesabı),
  // şifre yanlış. Ayırmak, geçerli e-posta adreslerinin listelenmesine yarardı.
  if (!user || !user.password || !passwordMatches) {
    throw ApiError.unauthorized('E-posta veya şifre hatalı.');
  }

  // Doğrulama kontrolü bilerek şifre kontrolünden SONRA. Önce yapılsaydı,
  // şifreyi bilmeyen biri de "bu adres kayıtlı ama doğrulanmamış" bilgisini
  // öğrenebilirdi.
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
 * Gövde: { idToken }  — tarayıcının Firebase'den aldığı ID token
 *
 * Google ile giriş ve kayıt aynı uçtan yürüyor: hesap yoksa açılıyor, varsa
 * bağlanıyor. Firebase token'ı yalnızca kimliği kanıtlamak için kullanılıyor;
 * oturum bizim kendi httpOnly cookie'lerimizle kuruluyor ve Firebase token'ı
 * istemcide saklanmıyor. Böylece oturum yönetimi tek bir mekanizmada kalıyor.
 *
 * @returns {{message: string, user: object}}
 */
async function loginWithGoogle(req, res) {
  if (!firebase.isEnabled()) {
    throw ApiError.serviceUnavailable('Google ile giriş bu ortamda yapılandırılmamış.');
  }

  const { idToken } = req.body || {};
  if (!idToken || typeof idToken !== 'string') {
    throw ApiError.badRequest('ID token eksik.');
  }

  // Token'ın doğrulanması şart: istemciden gelen hiçbir veri kanıt değil.
  // Doğrulama yapılmasaydı herkes istediği e-postayla uydurma token gönderip
  // başkasının hesabına girebilirdi.
  let decoded;
  try {
    decoded = await firebase.verifyIdToken(idToken);
  } catch (err) {
    // Hatanın sebebi loglanıyor ama kullanıcıya genel mesaj dönüyor:
    // "imza geçersiz" ile "süresi dolmuş" ayrımı saldırgana bilgi verir.
    logger.warn('Firebase ID token doğrulanamadı.', { reason: err.message });
    throw ApiError.unauthorized('Google doğrulaması başarısız.');
  }

  const email = assertValidEmail(decoded.email);

  // Bu kontrol hesap ele geçirmeye karşı kritik. Google'da doğrulanmamış bir
  // adresle hesap açmak mümkün; bu kontrol olmasaydı saldırgan kurbanın
  // e-postasıyla Google hesabı açıp aşağıdaki eşleştirme adımında sistemdeki
  // gerçek hesaba bağlanabilirdi.
  if (!decoded.email_verified) {
    throw ApiError.forbidden('Google hesabınızın e-posta adresi doğrulanmamış.');
  }

  // Ad ve fotoğraf her girişte tazeleniyor; kullanıcı Google tarafında
  // profilini değiştirdiğinde burada da güncel kalsın.
  const profile = {
    displayName: decoded.name || null,
    photoUrl: decoded.picture || null,
  };

  // Hata ayıklarken hangi claim'lerin geldiğini görmek gerekebiliyor. Yalnızca
  // alan ADLARI loglanıyor, değerler değil: token içeriği kişisel veri.
  logger.debug('Firebase token claim\'leri', {
    claims: Object.keys(decoded).join(','),
    hasName: Boolean(decoded.name),
    hasPicture: Boolean(decoded.picture),
  });

  // Hesap eşleştirme sırası önemli:
  //  1) googleUid — kullanıcı daha önce Google ile girmiş. E-postasını
  //     değiştirmiş olsa bile aynı hesaba bağlanır.
  //  2) e-posta — aynı adresle normal kayıt var; ikinci bir hesap açmak
  //     yerine mevcut hesaba Google kimliği bağlanır.
  //  3) hiçbiri — ilk kez geliyor, yeni kayıt açılır.
  let user = await User.findOne({ where: { googleUid: decoded.uid } });

  if (user) {
    await user.update(profile);
  } else {
    user = await User.findOne({ where: { email } });
    if (user) {
      // isVerified true yapılıyor: adresin sahibi olduğunu Google zaten
      // doğruladı, kullanıcıdan ikinci kez doğrulama istemek gereksiz.
      await user.update({ googleUid: decoded.uid, isVerified: true, ...profile });
      logger.info('Mevcut hesaba Google kimliği bağlandı.', { userId: user.id });
    } else {
      user = await User.create({
        email,
        // Şifresiz hesap. Kullanıcı isterse sonradan "Hesap güvenliği"
        // sayfasından şifre belirleyip ikinci giriş yolunu açabiliyor.
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

/**
 * POST /api/auth/refresh
 *
 * Access token'ın süresi dolduğunda frontend bunu kendiliğinden çağırıyor,
 * kullanıcı bir şey fark etmiyor. Asıl iş session.service'teki rotasyon
 * mantığında; burada yalnızca cookie okunuyor ve hata durumu toparlanıyor.
 */
async function refresh(req, res) {
  const presentedToken = req.cookies?.[tokenUtil.REFRESH_COOKIE];

  try {
    const user = await sessionService.rotateSession(res, presentedToken);
    res.json({ message: 'Oturum yenilendi.', user: user.toPublicJSON() });
  } catch (err) {
    // Yenileme başarısızsa eldeki cookie artık işe yaramıyor demektir.
    // Temizlenmezse istemci her istekte aynı ölü token'la yeniden deneyip
    // sonsuz bir 401 döngüsüne girer. 500 durumunda temizlemiyoruz: sorun
    // geçici bir sunucu hatası olabilir, kullanıcıyı oturumdan atmaya gerek yok.
    if (err instanceof ApiError && err.statusCode !== 500) {
      tokenUtil.clearAuthCookies(res);
    }
    throw err;
  }
}

/**
 * POST /api/auth/logout
 *
 * Yalnızca bu cihazın oturumunu kapatır: refresh token veritabanında iptal
 * edilir, cookie'ler silinir. Sunucu tarafında iptal etmek şart; sadece
 * cookie silmek, kopyalanmış bir token'ın geçerli kalmasına izin verirdi.
 */
async function logout(req, res) {
  await sessionService.revokeSession(req.cookies?.[tokenUtil.REFRESH_COOKIE]);
  tokenUtil.clearAuthCookies(res);
  res.json({ message: 'Çıkış yapıldı.' });
}

/**
 * POST /api/auth/logout-all
 *
 * Kullanıcının bütün cihazlardaki oturumlarını kapatır. Şifresinin ele
 * geçirildiğinden şüphelenen biri için gerekli.
 *
 * Rotada requireAuth yok, kimlik burada iki kaynaktan çözülüyor: varsa access
 * token'dan, yoksa refresh token'dan. Sebebi şu: bu özelliğe tam da access
 * token'ın süresi dolduğu durumda ihtiyaç duyuluyor ve o anda kullanıcıyı
 * "önce giriş yap" diye geri çevirmek özelliği işlevsiz kılardı.
 */
async function logoutAll(req, res) {
  let userId = req.user?.id;

  if (!userId) {
    const presentedToken = req.cookies?.[tokenUtil.REFRESH_COOKIE];
    if (presentedToken) {
      try {
        userId = Number(tokenUtil.verifyRefreshToken(presentedToken).sub);
      } catch {
        // Geçersiz token sessizce yok sayılıyor; akış aşağıdaki 401'e düşüyor.
        userId = undefined;
      }
    }
  }

  if (!userId) {
    // Kimlik çözülemese bile cookie'ler temizleniyor: kullanıcı zaten
    // çıkmak istiyor, elindeki bozuk oturumu bırakmanın anlamı yok.
    tokenUtil.clearAuthCookies(res);
    throw ApiError.unauthorized('Giriş yapmalısınız.');
  }

  await sessionService.revokeAllForUser(userId);
  tokenUtil.clearAuthCookies(res);
  logger.info('Tüm oturumlar kapatıldı.', { userId });

  res.json({ message: 'Tüm cihazlardan çıkış yapıldı.' });
}

/**
 * POST /api/auth/forgot-password
 * Gövde: { email }
 *
 * Adres kayıtlıysa sıfırlama bağlantısı gönderir. Cevap her durumda aynı:
 * "kayıtlı değil" demek, bu ucun e-posta adresi doğrulama aracı olarak
 * kullanılmasına izin verirdi. Kullanıcı deneyimi açısından biraz belirsiz
 * ama hesap varlığını gizlemek daha öncelikli.
 */
async function forgotPassword(req, res) {
  const email = assertValidEmail((req.body || {}).email);
  // withSecrets gerekli: password alanı varsayılan kapsamda seçilmiyor ve
  // aşağıda hesabın şifresi olup olmadığına bakılması gerekiyor.
  const user = await User.scope('withSecrets').findOne({ where: { email } });

  // Şifresi olmayan (yalnızca Google ile açılmış) hesaba sıfırlama bağlantısı
  // gönderilmiyor: sıfırlanacak bir şifre yok. Kullanıcıya bu durum da
  // söylenmiyor, aynı gerekçeyle.
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

/**
 * POST /api/auth/reset-password
 * Gövde: { token, newPassword }
 *
 * E-postadaki tek kullanımlık token ile şifreyi değiştirir. İşlem sonunda
 * kullanıcının bütün oturumları kapatılıyor: şifre sıfırlama genelde "hesabım
 * ele geçirildi" şüphesiyle yapılıyor ve saldırganın açık oturumu devam
 * ederse sıfırlamanın bir anlamı kalmıyor.
 */
async function resetPassword(req, res) {
  const { token, newPassword } = req.body || {};
  if (!token || typeof token !== 'string') {
    throw ApiError.badRequest('Sıfırlama bağlantısı geçersiz.');
  }
  // Yeni şifre için politika uygulanıyor (girişten farkı bu): kullanıcı zaten
  // yeni bir değer belirliyor, kuralların burada geçerli olması gerekiyor.
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
    // Token tek kullanımlık: aynı bağlantı ikinci kez çalışmamalı.
    resetPasswordToken: null,
    resetPasswordExpires: null,
  });

  await sessionService.revokeAllForUser(user.id);
  tokenUtil.clearAuthCookies(res);
  logger.info('Şifre sıfırlandı, tüm oturumlar kapatıldı.', { userId: user.id });

  res.json({ message: 'Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.' });
}

/**
 * POST /api/auth/set-password
 * Gövde: { currentPassword?, newPassword }
 *
 * İki işi birden görüyor: Google ile açılmış şifresiz hesaba şifre eklemek ve
 * mevcut şifreyi değiştirmek. Hangi durumda olduğumuzu kullanıcının kendi
 * kaydından anlıyoruz, istemcinin söylediğine göre değil.
 *
 * Şifre zaten varsa mevcut şifre zorunlu. Sadece oturum açık olmasına
 * güvenilseydi, ele geçirilmiş bir access token'la şifre değiştirilip hesabın
 * tamamı devralınabilirdi; mevcut şifre bu adımda ikinci bir kanıt oluyor.
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

  // Kimlik bilgisi değiştiği için diğer cihazlardaki oturumlar kapatılıyor.
  // Hemen ardından bu cihaz için yeni oturum açılıyor: aksi halde kullanıcı
  // kendi şifresini değiştirdiği için giriş ekranına atılırdı.
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

/**
 * GET /api/auth/me
 *
 * Frontend açılışta bunu çağırıp oturumun geçerli olup olmadığını öğreniyor.
 * Kullanıcı bilgisi token'dan değil veritabanından okunuyor: rol ya da profil
 * token üretildikten sonra değişmiş olabilir.
 *
 * Token geçerli ama kayıt yoksa (hesap silinmişse) 401 dönülüyor; bu noktada
 * elimizdeki oturum artık var olmayan bir kullanıcıya ait.
 */
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
