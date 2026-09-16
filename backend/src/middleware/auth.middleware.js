const tokenUtil = require('../utils/token');
const ApiError = require('../utils/apiError');

// Access token yalnızca httpOnly cookie'den okunur; Authorization header desteklenmez.
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
    // İstemci süresi dolan token'ı yenileyebilsin diye ayrı kod dönülür.
    const expired = err.name === 'TokenExpiredError';
    return next(ApiError.unauthorized(
      expired ? 'Oturum süresi doldu.' : 'Geçersiz oturum.',
      { code: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN' }
    ));
  }
}

// requireAuth'tan sonra kullanılır.
function requireRoles(...allowedRoles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return next(ApiError.unauthorized('Giriş yapmalısınız.'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('Bu işlem için yetkiniz yok.'));
    }
    return next();
  };
}

module.exports = { requireAuth, requireRoles };
