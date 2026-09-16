import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAuthStatus } from '../features/auth/authSlice';
import FullPageSpinner from '../components/ui/FullPageSpinner';

// Giriş yapmış kullanıcıyı login/register sayfalarında tutmaz.
export default function PublicOnlyRoute() {
  const status = useSelector(selectAuthStatus);
  const location = useLocation();

  if (status === 'idle' || status === 'loading') {
    return <FullPageSpinner label="Yükleniyor…" />;
  }

  if (status === 'authenticated') {
    const target = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
