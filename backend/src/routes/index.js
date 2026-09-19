/**
 * Rotaların toplandığı yer.
 *
 * app.js tek bir router bağlıyor, alt rotalar buradan dallanıyor. Böylece yeni
 * bir alan (örn. /orders) eklendiğinde app.js'e dokunmak gerekmiyor ve bütün
 * uçların listesi tek bakışta görülüyor.
 */
const express = require('express');
const authRoutes = require('./auth.routes');
const dashboardRoutes = require('./dashboard.routes');

const router = express.Router();

// GET /api/health — sunucunun ve sürecin ayakta olduğunu bildirir.
// Docker healthcheck ve deploy sonrası kontrol için; kimlik doğrulaması yok
// çünkü tam da oturum açılamadığı durumlarda sunucuya erişilebildiğini
// görebilmek gerekiyor. Hassas hiçbir bilgi dönmüyor.
router.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

router.use('/auth', authRoutes);
router.use('/', dashboardRoutes);

module.exports = router;
