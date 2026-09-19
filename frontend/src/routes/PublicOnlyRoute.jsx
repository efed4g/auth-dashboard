import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAuthStatus } from '../features/auth/authSlice';
import FullPageSpinner from '../components/ui/FullPageSpinner';

/**
 * ProtectedRoute'un tersi: yalnızca oturumu OLMAYANLARIN görmesi gereken
 * sayfaları (giriş, kayıt, şifremi unuttum) sarmalar.
 *
 * Oturumu açık bir kullanıcıyı giriş formunda tutmak kafa karıştırıcı; tekrar
 * giriş yapmaya çalışırsa da gereksiz bir oturum daha açılır.
 */
export default function PublicOnlyRoute() {
  const status = useSelector(selectAuthStatus);
  const location = useLocation();

  if (status === 'idle' || status === 'loading') {
    return <FullPageSpinner label="Yükleniyor…" />;
  }

  if (status === 'authenticated') {
    // ProtectedRoute'un state'e koyduğu adres varsa oraya dönülüyor: kullanıcı
    // korumalı bir sayfaya gitmek isteyip giriş ekranına düştüyse, giriş
    // yaptıktan sonra hedefine ulaşsın.
    const target = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
