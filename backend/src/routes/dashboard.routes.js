const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/dashboard.controller');
const { requireAuth, requireRoles } = require('../middleware/auth.middleware');
const { requireActive } = require('../middleware/active.middleware');

/**
 * Uygulama içeriğini sunan uçlar: hepsi geçerli oturum gerektiriyor ve iş
 * verisi döndürüyor.
 */
const router = express.Router();

router.get('/dashboard', requireAuth, requireActive, asyncHandler(controller.getDashboard));

// Middleware sırası en genelden en özele: önce kimlik (req.user dolar), sonra
// hesabın açık olması, en son yetki. Arayüzde menüyü gizlemek erişimi
// engellemez; asıl kontrol burada.
router.get(
  '/admin/users',
  requireAuth,
  requireActive,
  requireRoles('admin'),
  asyncHandler(controller.listUsers)
);

module.exports = router;
