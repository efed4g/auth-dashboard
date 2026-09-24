/**
 * Rotaların toplandığı yer. app.js tek bir router bağlıyor, alt rotalar
 * buradan dallanıyor; yeni bir alan eklendiğinde app.js'e dokunmak gerekmiyor.
 */
const express = require('express');
const authRoutes = require('./auth.routes');
const dashboardRoutes = require('./dashboard.routes');
const profileRoutes = require('./profile.routes');

const router = express.Router();

// Docker healthcheck ve deploy sonrası kontrol için. Kimlik doğrulaması yok:
// tam da oturum açılamadığında sunucuya erişilebildiğini görmek gerekiyor.
router.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
// Kök eşleşmesi en sonda: yukarıdaki önekler denendikten sonra devreye girsin.
router.use('/', dashboardRoutes);

module.exports = router;
