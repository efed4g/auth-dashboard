import React, { useState, useEffect } from 'react';
import GoogleLogin from './components/GoogleLogin';
import Register from './components/Register';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Logout from './components/Logout';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import { fetchWithAutoRefresh } from './helpers/fetchWithAutoRefresh';

function App() {
  const [showDashboard, setShowDashboard] = useState(false);
  const [checking, setChecking] = useState(true);

  // Ekran durumları: 'login', 'register', 'forgot', 'reset'
  const [currentView, setCurrentView] = useState('login');

  // URL'den resetToken okuma
  const searchParams = new URLSearchParams(window.location.search);
  const resetToken = searchParams.get('resetToken');

  useEffect(() => {
    if (resetToken) {
      setCurrentView('reset');
      setChecking(false);
      return;
    }

    const apiUrl = import.meta.env.VITE_API_URL;
    fetchWithAutoRefresh(`${apiUrl}/dashboard`, {
      credentials: 'include',
    })
      .then((res) => {
        setShowDashboard(res.ok);
      })
      .catch(() => setShowDashboard(false))
      .finally(() => setChecking(false));
  }, [resetToken]);

  const handleResetComplete = () => {
    window.location.href = '/'; // URL'i temizleyip ana sayfaya atar
  };

  if (checking) return <div>Yükleniyor...</div>;

  return (
    <div>
      {!showDashboard ? (
        <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>

          {currentView === 'reset' && (
            <ResetPassword token={resetToken} onComplete={handleResetComplete} />
          )}

          {currentView === 'forgot' && (
            <ForgotPassword onCancel={() => setCurrentView('login')} />
          )}

          {currentView === 'login' && (
            <>
              <Login onLoginSuccess={() => setShowDashboard(true)} />
              <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between' }}>
                <button style={{ background: 'none', border: 'none', color: 'blue', cursor: 'pointer', padding: 0 }} onClick={() => setCurrentView('register')}>Hesabın yok mu? Kayıt Ol</button>
                <button style={{ background: 'none', border: 'none', color: 'gray', cursor: 'pointer', padding: 0 }} onClick={() => setCurrentView('forgot')}>Şifremi Unuttum</button>
              </div>
            </>
          )}

          {currentView === 'register' && (
            <>
              <Register />
              <p style={{ marginTop: '15px' }}>
                Zaten hesabın var mı?{' '}
                <button style={{ background: 'none', border: 'none', color: 'blue', cursor: 'pointer', padding: 0 }} onClick={() => setCurrentView('login')}>Giriş Yap</button>
              </p>
            </>
          )}

          {/* Şifre sıfırlama ekranlarında Google Login'i gizle */}
          {(currentView === 'login' || currentView === 'register') && (
            <>
              <hr style={{ margin: '20px 0' }} />
              <GoogleLogin onLoginSuccess={() => setShowDashboard(true)} />
            </>
          )}

        </div>
      ) : (
        <div className="relative">
          <Dashboard />
          <div className="absolute top-8 right-8">
            <Logout onLogout={() => setShowDashboard(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
