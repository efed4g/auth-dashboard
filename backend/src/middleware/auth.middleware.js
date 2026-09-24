/**
 * Kimlik ve yetki kontrolü. Erişimi gerçekten kesen yer burası; frontend'deki
 * ProtectedRoute yalnızca arayüz kolaylığı, API'ye tarayıcısız da istek atılabilir.
 */
const tokenUtil = require('../utils/token');
const ApiError = require('../utils/apiError');

/**
 * Geçerli access token arar, bulursa req.user'ı doldurur.
 *
 * Token yalnızca httpOnly cookie'den okunuyor; Authorization başlığı bilerek
 * desteklenmiyor, yoksa token'ı JavaScript'in erişebildiği bir yerde tutmak
 * gerekir ve httpOnly tercihinin anlamı kalmazdı.
 */
function requireAuth(req, res, next) {
  const token = req.cookies?.[tokenUtil.ACCESS_COOKIE];
  if (!token) {
    return next(ApiError.unauthorized('Giriş yapmalısınız.', { code: 'NO_SESSION' }));
  }

  try {
    const payload = tokenUtil.verifyAccessToken(token);
    req.user = {
      id: Number(payload.sub),
      email: payload.email,
      role: payload.role,
    };
    return next();
  } catch (err) {
    // "Süresi doldu" ile "geçersiz" ayrı kodlar: ilkinde istemci /auth/refresh
    // deneyip isteği tekrarlayabilir, ikincisinde denemesi anlamsız.
    const expired = err.name === 'TokenExpiredError';
    return next(ApiError.unauthorized(
      expired ? 'Oturum süresi doldu.' : 'Geçersiz oturum.',
      { code: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN' }
    ));
  }
}

/**
 * Rol kontrolü. requireAuth'tan SONRA zincire eklenmeli; req.user'ın dolu
 * olmasına güveniyor.
 *
 * @param {...string} allowedRoles Erişime izin verilen roller
 */
function requireRoles(...allowedRoles) {
  return function roleGuard(req, res, next) {
    // Yanlış sırada kullanılırsa sessizce herkesi geçirmesin.
    if (!req.user) {
      return next(ApiError.unauthorized('Giriş yapmalısınız.'));
    }
    // 403: kullanıcı tanınıyor ama bu kaynağa yetkisi yok.
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('Bu işlem için yetkiniz yok.'));
    }
    return next();
  };
}

module.exports = { requireAuth, requireRoles };
