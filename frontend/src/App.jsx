import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetMeQuery } from './features/auth/authApi';
import { selectAuthStatus } from './features/auth/authSlice';

import ProtectedRoute from './routes/ProtectedRoute';
import PublicOnlyRoute from './routes/PublicOnlyRoute';
import AppShell from './components/layout/AppShell';
import FullPageSpinner from './components/ui/FullPageSpinner';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import SecurityPage from './pages/SecurityPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';

/**
 * Uygulama açılırken oturum durumunu bir kez belirler.
 *
 * Token httpOnly cookie'de olduğu için "oturum açık mı" sorusunun tek cevabı
 * sunucuya sormak. Rotalar çizilmeden önce beklenmeseydi sayfa önce "oturum
 * yok" varsayıp giriş ekranına atar, cevap gelince geri dönerdi.
 */
function SessionBootstrap({ children }) {
  useGetMeQuery();
  const status = useSelector(selectAuthStatus);

  if (status === 'idle' || status === 'loading') {
    return <FullPageSpinner label="Oturum kontrol ediliyor…" />;
  }
  return children;
}

/**
 * Rota tanımları. Erişim kurallarına göre gruplanmış: sarmalayıcı rota
 * bileşenleri sayesinde yeni sayfa eklerken kontrolü unutmak mümkün değil.
 */
export default function App() {
  return (
    <BrowserRouter>
      <SessionBootstrap>
        <Routes>
          {/* Oturum açmış kullanıcıyı panele geri gönderir. */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          {/* Bilerek hiçbir grupta değil: kullanıcı buraya e-postadaki
              bağlantıyla geliyor, oturumu açık da olabilir kapalı da. */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* AppShell iç içe: üst menü her sayfada tekrar yazılmasın. */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profil" element={<ProfilePage />} />
              <Route path="/guvenlik" element={<SecurityPage />} />
            </Route>
          </Route>

          {/* Ayrı grup: rol kontrolü de gerekiyor. Veri backend'de
              requireRoles ile korunuyor, buradaki kontrol arayüz kolaylığı. */}
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route element={<AppShell />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Route>

          {/* Oturum yoksa ProtectedRoute devreye girip giriş ekranına alıyor. */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </SessionBootstrap>
    </BrowserRouter>
  );
}
