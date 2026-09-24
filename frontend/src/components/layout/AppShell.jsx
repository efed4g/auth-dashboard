import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from '../../features/auth/authSlice';
import { useLogoutMutation, useLogoutAllMutation } from '../../features/auth/authApi';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';

/**
 * Oturum açmış kullanıcının gördüğü ortak çerçeve: üst menü, hesap menüsü ve
 * sayfa içeriği. Rota seviyesinde sarmalayıcı (bkz. App.jsx), böylece sayfa
 * geçişlerinde yeniden kurulmuyor.
 */

// NavLink, aktif bağlantıyı kendisi işaretliyor; sınıfı buna göre üretiyoruz.
const navLinkClass = ({ isActive }) =>
  'rounded-lg px-3 py-1.5 text-sm font-medium transition ' +
  (isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100');

export default function AppShell() {
  const user = useSelector(selectUser);
  const navigate = useNavigate();
  const [logout, { isLoading: loggingOut }] = useLogoutMutation();
  const [logoutAll, { isLoading: loggingOutAll }] = useLogoutAllMutation();
  const [menuOpen, setMenuOpen] = useState(false);

  /**
   * Çıkış. Yönlendirme finally içinde: sunucuya ulaşılamasa bile kullanıcıyı
   * uygulamanın içinde bırakmak yanlış olurdu.
   *
   * @param {boolean} everywhere true ise bütün cihazlardaki oturumlar kapanır
   */
  const handleLogout = async (everywhere) => {
    setMenuOpen(false);
    try {
      await (everywhere ? logoutAll() : logout()).unwrap();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/dashboard" className="text-sm font-bold tracking-tight text-slate-900">
            Auth Dashboard
          </Link>

          <nav className="flex items-center gap-1">
            <NavLink to="/dashboard" className={navLinkClass}>Dashboard</NavLink>
            <NavLink to="/profil" className={navLinkClass}>Profil</NavLink>
            {/* Gizlemek güvenlik önlemi değil; adres elle yazılsa da
                ProtectedRoute ve backend devreye giriyor. */}
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={navLinkClass}>Yönetim</NavLink>
            )}
          </nav>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Avatar user={user} />
              <span className="hidden sm:inline">{user?.displayName || user?.email}</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 z-10 mt-2 w-60 space-y-2 rounded-xl bg-white p-3 shadow-lg ring-1 ring-slate-900/5">
                <Link
                  to="/guvenlik"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Hesap güvenliği
                  {user && !user.hasPassword && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      şifre yok
                    </span>
                  )}
                </Link>
                <Button
                  variant="secondary"
                  loading={loggingOut}
                  onClick={() => handleLogout(false)}
                >
                  Çıkış yap
                </Button>
                <Button
                  variant="danger"
                  loading={loggingOutAll}
                  onClick={() => handleLogout(true)}
                >
                  Tüm cihazlardan çık
                </Button>
                <p className="text-xs text-slate-500">
                  Tüm cihazlardan çıkış, kayıtlı bütün refresh token'ları iptal eder.
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
