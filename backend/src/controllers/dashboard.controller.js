const { User, RefreshToken } = require('../models');

// GET /api/dashboard — içerik role göre değişir, admin verisi user'a gönderilmez.
async function getDashboard(req, res) {
  const user = await User.findByPk(req.user.id);

  const activeSessions = await RefreshToken.count({
    where: { userId: req.user.id, revokedAt: null },
  });

  const payload = {
    user: user.toPublicJSON(),
    widgets: [
      { key: 'account', label: 'Hesap', value: user.email },
      { key: 'role', label: 'Rol', value: user.role },
      { key: 'sessions', label: 'Aktif oturum', value: activeSessions },
    ],
  };

  if (user.role === 'admin') {
    payload.admin = {
      totalUsers: await User.count(),
      verifiedUsers: await User.count({ where: { isVerified: true } }),
      activeSessions: await RefreshToken.count({ where: { revokedAt: null } }),
    };
  }

  res.json(payload);
}

// GET /api/admin/users — yetki kontrolü route'taki requireRoles('admin') ile.
async function listUsers(req, res) {
  const users = await User.findAll({
    order: [['id', 'ASC']],
    limit: 100,
  });

  res.json({ users: users.map((user) => user.toPublicJSON()) });
}

module.exports = { getDashboard, listUsers };
