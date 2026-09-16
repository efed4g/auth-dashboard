import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useLoginMutation } from '../features/auth/authApi';
import { getErrorMessage } from '../lib/errors';
import AuthCard from '../components/layout/AuthCard';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import GoogleButton from '../components/GoogleButton';

// Backend, e-posta doğrulamasından sonra buraya ?verified=... ile yönlendirir.
const VERIFICATION_MESSAGES = {
  success: 'E-posta adresiniz doğrulandı. Şimdi giriş yapabilirsiniz.',
  invalid: 'Doğrulama bağlantısı geçersiz veya süresi dolmuş.',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [login, { isLoading }] = useLoginMutation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const verifiedStatus = searchParams.get('verified');
  const notice = VERIFICATION_MESSAGES[verifiedStatus];

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await login(form).unwrap();
      const target = location.state?.from?.pathname || '/dashboard';
      navigate(target, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Giriş yapılamadı.'));
    }
  };

  return (
    <AuthCard
      title="Giriş yap"
      subtitle="Dashboard'a erişmek için hesabınıza giriş yapın."
      footer={
        <>
          Hesabınız yok mu?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
            Kayıt olun
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {notice && (
          <Alert tone={verifiedStatus === 'success' ? 'success' : 'error'}>{notice}</Alert>
        )}
        <Alert tone="error">{error}</Alert>

        <TextField
          label="E-posta"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={handleChange}
          placeholder="ornek@firma.com"
        />

        <TextField
          label="Şifre"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={handleChange}
        />

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Şifremi unuttum
          </Link>
        </div>

        <Button type="submit" loading={isLoading}>Giriş yap</Button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs uppercase tracking-wide text-slate-400">
            veya
          </span>
        </div>
      </div>

      <GoogleButton />
    </AuthCard>
  );
}
