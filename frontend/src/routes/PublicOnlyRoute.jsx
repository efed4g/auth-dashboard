import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAuthStatus } from '../features/auth/authSlice';
import FullPageSpinner from '../components/ui/FullPageSpinner';

/**
 * ProtectedRoute'un tersi: yalnızca oturumu olmayanların görmesi gereken
 * sayfaları (giriş, kayıt, şifremi unuttum) sarmalar. Aksi halde tekrar giriş
 * denemesi gereksiz bir oturum daha açardı.
 */
export default function PublicOnlyRoute() {
  const status = useSelector(selectAuthStatus);
  const location = useLocation();

  if (status === 'idle' || status === 'loading') {
    return <FullPageSpinner label="Yükleniyor…" />;
  }

  if (status === 'authenticated') {
    // ProtectedRoute'un state'e koyduğu adres varsa oraya dönülüyor.
    const target = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
