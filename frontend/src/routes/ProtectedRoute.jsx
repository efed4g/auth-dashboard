import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAuthStatus, selectUser } from '../features/auth/authSlice';
import FullPageSpinner from '../components/ui/FullPageSpinner';
import InactiveAccountPage from '../pages/InactiveAccountPage';

/**
 * Oturum (ve isteğe bağlı rol) gerektiren rotaları sarmalar.
 *
 * Bu katman güvenlik önlemi DEĞİL, arayüz kolaylığı: gerçek koruma
 * backend'deki requireAuth/requireRoles middleware'lerinde.
 *
 * @param {string[]} [roles] Verilirse yalnızca bu rollere izin verilir
 */
export default function ProtectedRoute({ roles }) {
  const status = useSelector(selectAuthStatus);
  const user = useSelector(selectUser);
  const location = useLocation();

  // "Bilmiyoruz" durumunu "oturum yok" saymak, sayfa her yenilendiğinde
  // kullanıcıyı kısa süreliğine giriş ekranına atardı.
  if (status === 'idle' || status === 'loading') {
    return <FullPageSpinner label="Oturum kontrol ediliyor…" />;
  }

  if (status !== 'authenticated') {
    // Gelinmek istenen adres state'te taşınıyor: giriş sonrası kullanıcı
    // hedefine dönsün. replace ile geri tuşu korumalı sayfaya sıçramasın.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Rol kontrolünden önce: pasif bir admin'e "yetkin var" deyip sonra duvara
  // çarptırmak yerine doğrudan durumu anlatıyoruz.
  if (user && !user.isActive) {
    return <InactiveAccountPage />;
  }

  // Oturum var ama rol uymuyor; giriş ekranına göndermek yanlış olurdu.
  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Outlet: bu sarmalayıcının içine yerleştirilmiş asıl sayfa.
  return <Outlet />;
}
