import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAuthStatus, selectUser } from '../features/auth/authSlice';
import FullPageSpinner from '../components/ui/FullPageSpinner';

/**
 * Oturum (ve isteğe bağlı olarak rol) gerektiren rotaları sarmalar.
 *
 * Bu katman bir güvenlik önlemi DEĞİL, arayüz kolaylığı. Gerçek koruma
 * backend'deki requireAuth/requireRoles middleware'lerinde; buradaki kontrol
 * atlansa bile API veri döndürmez. Amaç, yetkisi olmayan kullanıcıyı boş ya
 * da hata dolu bir ekranla karşılaştırmak yerine doğru yere yönlendirmek.
 *
 * @param {string[]} [roles] Verilirse yalnızca bu rollere izin verilir
 */
export default function ProtectedRoute({ roles }) {
  const status = useSelector(selectAuthStatus);
  const user = useSelector(selectUser);
  const location = useLocation();

  // Oturum durumu henüz bilinmiyorken karar vermemek önemli: "bilmiyoruz"
  // durumunu "oturum yok" saymak, sayfa her yenilendiğinde kullanıcıyı
  // kısa süreliğine giriş ekranına atardı.
  if (status === 'idle' || status === 'loading') {
    return <FullPageSpinner label="Oturum kontrol ediliyor…" />;
  }

  if (status !== 'authenticated') {
    // Gelinmek istenen adres state'te taşınıyor; giriş yaptıktan sonra
    // kullanıcı panele değil, gitmek istediği sayfaya dönebilsin.
    // replace kullanılıyor ki geri tuşu korumalı sayfaya geri sıçramasın.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Oturum var ama rol uymuyor. Giriş ekranına göndermek yanlış olurdu:
  // kullanıcı giriş yapmış durumda, sorun yetkisinin yetmemesi.
  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Outlet: bu sarmalayıcının içine yerleştirilmiş asıl sayfa.
  return <Outlet />;
}
