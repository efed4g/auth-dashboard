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
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';

/**
 * Uygulama açılırken oturum durumunu bir kez belirler.
 *
 * Token httpOnly cookie'de olduğu için JavaScript "oturum açık mı" sorusunu
 * kendi başına cevaplayamıyor; tek yol sunucuya sormak. Bu yüzden rotalar
 * çizilmeden önce /auth/me çağrılıyor ve cevap gelene kadar yükleniyor
 * ekranı gösteriliyor.
 *
 * Bu bekleme olmasaydı sayfa önce "oturum yok" varsayıp kullanıcıyı giriş
 * ekranına atar, cevap gelince dashboard'a geri döndürürdü; her yenilemede
 * gözle görülür bir sıçrama olurdu.
 *
 * Access token'ın süresi dolmuşsa baseQuery bunu fark edip sessizce
 * yeniliyor, burada ek bir şey yapmak gerekmiyor.
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
 * Rota tanımları.
 *
 * Rotalar erişim kurallarına göre gruplanmış durumda: herkese açık olanlar,
 * yalnızca oturum açmamışların görmesi gerekenler, oturum gerektirenler ve
 * admin'e özel olanlar. Her sayfaya tek tek kontrol yazmak yerine sarmalayıcı
 * rota bileşenleri kullanmak, yeni bir sayfa eklerken kontrolü unutma
 * ihtimalini ortadan kaldırıyor.
 */
export default function App() {
  return (
    <BrowserRouter>
      <SessionBootstrap>
        <Routes>
          {/* Oturum açmış kullanıcıyı giriş/kayıt ekranında tutmanın anlamı
              yok; bu grup onu panele geri gönderiyor. */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          {/* Şifre sıfırlama bilerek hiçbir grubun içinde değil: kullanıcı
              buraya e-postadaki bağlantıyla geliyor ve o sırada oturumu açık
              da olabilir, kapalı da. İki durumda da sayfa çalışmalı. */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Oturum gerektiren sayfalar. AppShell iç içe kullanılıyor ki
              üst menü her sayfada tekrar yazılmasın. */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/guvenlik" element={<SecurityPage />} />
            </Route>
          </Route>

          {/* Admin sayfası ayrı bir grupta, çünkü rol kontrolü de gerekiyor.
              Buradaki kontrol yalnızca arayüz kolaylığı; verinin kendisi
              backend'de requireRoles ile korunuyor. */}
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route element={<AppShell />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Route>

          {/* Kök adres panele yönlendiriliyor; oturum yoksa ProtectedRoute
              devreye girip giriş ekranına alıyor. */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </SessionBootstrap>
    </BrowserRouter>
  );
}
