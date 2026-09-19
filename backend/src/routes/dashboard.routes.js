const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/dashboard.controller');
const { requireAuth, requireRoles } = require('../middleware/auth.middleware');

/**
 * Uygulama içeriğini sunan uçlar.
 *
 * Auth rotalarından ayrı tutuldu: buradaki uçların ortak özelliği hepsinin
 * geçerli bir oturum gerektirmesi ve iş verisi döndürmesi.
 */
const router = express.Router();

// GET /api/dashboard — oturum sahibinin panel verisi.
router.get('/dashboard', requireAuth, asyncHandler(controller.getDashboard));

// GET /api/admin/users — yalnızca admin.
// İki middleware'in sırası önemli: requireRoles, req.user'ı requireAuth'un
// doldurmuş olmasına güveniyor. Yetki kontrolü burada, sunucu tarafında
// yapılıyor; arayüzde menüyü gizlemek erişimi engellemez, adres çubuğuna
// yazarak ya da doğrudan API'ye istek atarak denenebilir.
router.get(
  '/admin/users',
  requireAuth,
  requireRoles('admin'),
  asyncHandler(controller.listUsers)
);

module.exports = router;
