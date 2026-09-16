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

// Açılışta oturum bir kez sorulur; access token süresi dolmuşsa baseQuery
// otomatik olarak /auth/refresh dener.
function SessionBootstrap({ children }) {
  useGetMeQuery();
  const status = useSelector(selectAuthStatus);

  if (status === 'idle' || status === 'loading') {
    return <FullPageSpinner label="Oturum kontrol ediliyor…" />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionBootstrap>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          {/* E-postadaki bağlantı oturum durumundan bağımsız çalışmalı */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/guvenlik" element={<SecurityPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route element={<AppShell />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </SessionBootstrap>
    </BrowserRouter>
  );
}
