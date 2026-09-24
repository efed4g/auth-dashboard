/**
 * Profil rotaları — hepsi /api/profile altında.
 *
 * Adreste kullanıcı kimliği yok: kaynak zaten "isteği yapan kişinin profili"
 * ve bu bilgi token'dan geliyor.
 */
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/profile.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireActive } = require('../middleware/active.middleware');
const { uploadPhoto } = require('../middleware/upload.middleware');

const router = express.Router();

// Tüm rotalar korumalı. Tek tek yazmak yerine böyle: yeni bir uç eklendiğinde
// korumayı yazmayı unutmak mümkün değil.
router.use(requireAuth);
router.use(requireActive);

router.get('/locations', asyncHandler(controller.getLocations));

// uploadPhoto dosyayı doğrulayıp belleğe alıyor; controller'a ulaştığında tür
// ve boyut kontrolü geçilmiş oluyor.
router.post('/photo', uploadPhoto, asyncHandler(controller.uploadMyPhoto));
router.delete('/photo', asyncHandler(controller.deleteMyPhoto));

router.get('/', asyncHandler(controller.getMyProfile));
router.post('/', asyncHandler(controller.createMyProfile));
router.put('/', asyncHandler(controller.updateMyProfile));
router.delete('/', asyncHandler(controller.deleteMyProfile));

module.exports = router;
