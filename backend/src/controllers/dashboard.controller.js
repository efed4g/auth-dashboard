/**
 * Panel verilerini hazırlayan controller.
 */
const { User, RefreshToken } = require('../models');
const profileService = require('../services/profile.service');

/**
 * GET /api/dashboard
 *
 * Oturum sahibinin panel verisini döner. Rol bazlı ayrım burada yapılıyor ve
 * önemli olan nokta şu: admin'e özel bölüm normal kullanıcıya gönderilip
 * arayüzde gizlenmiyor, cevaba hiç eklenmiyor. Gizleme yaklaşımı veriyi ağ
 * üzerinden erişilebilir bırakırdı; tarayıcı konsolundan okumak yeterdi.
 *
 * @returns {{user: object, displayName: string, profileCompletion: object,
 *            widgets: Array, admin?: object}}
 */
async function getDashboard(req, res) {
  // Kullanıcı token'dan değil veritabanından okunuyor: rol veya profil
  // bilgisi token üretildikten sonra değişmiş olabilir.
  const user = await User.findByPk(req.user.id);

  // Kullanıcının kaç cihazda açık oturumu olduğu. İptal edilmemiş refresh
  // token sayısı bunun doğrudan karşılığı.
  const activeSessions = await RefreshToken.count({
    where: { userId: req.user.id, revokedAt: null },
  });

  // Profili olmamak hata değil, yeni kullanıcının normal durumu: null dönüyor.
  const profile = await profileService.getProfile(user.id);

  const payload = {
    user: user.toPublicJSON(),
    // Hitap için üç kaynak, en kişiselden en genele: kullanıcının kendi
    // girdiği ad soyad, Google profilinden gelen ad, son çare e-posta.
    // Sıralama sunucuda kuruluyor ki her ekran aynı mantığı tekrarlamasın.
    displayName: profile
      ? `${profile.firstName} ${profile.lastName}`
      : (user.displayName || user.email),
    // Oran profile.service'te hesaplanıyor: aynı bilgi profil sayfasında da
    // gerekiyor ve kuralı iki yerde ayrı tutmak kaymaya yol açardı.
    profileCompletion: profileService.calculateCompletion(profile),
    widgets: [
      { key: 'account', label: 'Hesap', value: user.email },
      { key: 'role', label: 'Rol', value: user.role },
      // İyelik eki bilerek: yönetici özetinde sistem genelini sayan bir
      // "Toplam aktif oturum" kartı da var, ikisi aynı ekranda görünüyor.
      { key: 'sessions', label: 'Aktif oturumların', value: activeSessions },
    ],
  };

  // Yönetici özeti yalnızca rol uyuyorsa hesaplanıyor. Sorguların koşulun
  // içinde olması ayrıca gereksiz veritabanı yükünü de önlüyor.
  if (user.role === 'admin') {
    payload.admin = {
      totalUsers: await User.count(),
      verifiedUsers: await User.count({ where: { isVerified: true } }),
      activeSessions: await RefreshToken.count({ where: { revokedAt: null } }),
    };
  }

  res.json(payload);
}

/**
 * GET /api/admin/users
 *
 * Kullanıcı listesi. Yetki kontrolü burada değil rota tanımında
 * (requireRoles('admin')); controller yalnızca veriyi hazırlıyor.
 *
 * toPublicJSON'dan geçirmek burada ayrıca önemli: admin de olsa kimsenin
 * şifre hash'lerini ya da sıfırlama token'larını görmesine gerek yok.
 *
 * limit: 100 — sayfalama eklenmediği için listenin sınırsız büyümesini
 * engelleyen basit bir üst sınır.
 */
async function listUsers(req, res) {
  const users = await User.findAll({
    order: [['id', 'ASC']],
    limit: 100,
  });

  res.json({ users: users.map((user) => user.toPublicJSON()) });
}

module.exports = { getDashboard, listUsers };
