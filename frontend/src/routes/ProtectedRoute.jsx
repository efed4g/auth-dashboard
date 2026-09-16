import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAuthStatus, selectUser } from '../features/auth/authSlice';
import FullPageSpinner from '../components/ui/FullPageSpinner';

/**
 * Oturum yoksa login'e yönlendirir.
 * Asıl koruma backend'deki requireAuth middleware'idir; bu katman UX içindir.
 */
export default function ProtectedRoute({ roles }) {
  const status = useSelector(selectAuthStatus);
  const user = useSelector(selectUser);
  const location = useLocation();

  if (status === 'idle' || status === 'loading') {
    return <FullPageSpinner label="Oturum kontrol ediliyor…" />;
  }

  if (status !== 'authenticated') {
    // Giriş sonrası kullanıcıyı gitmek istediği sayfaya döndürmek için.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
