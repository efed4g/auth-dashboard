import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useLoginMutation } from '../features/auth/authApi';
import { getErrorMessage } from '../lib/errors';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import GoogleButton from '../components/GoogleButton';

/**
 * Giriş sayfası.
 *
 * Form durumu tek bir nesnede tutuluyor (her alan için ayrı useState yerine);
 * alanlar name özniteliğiyle eşleştiği için tek bir onChange yetiyor.
 */

// Backend, e-posta doğrulama ucundan sonra kullanıcıyı buraya ?verified=...
// parametresiyle yönlendiriyor. Kodun mesaja çevrilmesi arayüzün işi.
const VERIFICATION_MESSAGES = {
  success: 'E-posta adresiniz doğrulandı. Şimdi giriş yapabilirsiniz.',
  invalid: 'Doğrulama bağlantısı geçersiz veya süresi dolmuş.',
};

// Etiketler sr-only: placeholder tek başına ekran okuyucular için yeterli bir
// etiket sayılmıyor ve yazmaya başlayınca kayboluyor.
const inputClass =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 transition focus:border-brand-500 focus:bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500/20';

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
      // unwrap(): hatayı sonuç nesnesi yerine fırlatılır hale getiriyor.
      await login(form).unwrap();
      // Korumalı bir sayfadan yönlendirildiyse oraya, değilse panele.
      const target = location.state?.from?.pathname || '/dashboard';
      // replace: geri tuşu giriş formuna geri getirmesin.
      navigate(target, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Giriş yapılamadı.'));
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-white px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-center text-3xl font-bold tracking-tight text-slate-900">
          Giriş yap
        </h1>

        <div className="mt-8 space-y-4">
          {notice && (
            <Alert tone={verifiedStatus === 'success' ? 'success' : 'error'}>{notice}</Alert>
          )}
          <Alert tone="error">{error}</Alert>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-3">
          <div>
            <label htmlFor="email" className="sr-only">E-posta</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="E-posta adresi"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="password" className="sr-only">Şifre</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={handleChange}
              placeholder="Şifre"
              className={inputClass}
            />
          </div>

          <div className="pt-1">
            <Button type="submit" loading={isLoading} className="py-3">
              Giriş yap
            </Button>
          </div>
        </form>

        {/* "veya" ayıracı — şifre alanının ve giriş butonunun altında */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs text-slate-400">veya</span>
          </div>
        </div>

        <GoogleButton />

        <div className="mt-8 space-y-3">
          <Link
            to="/register"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border
                       border-slate-200 py-3 text-sm font-semibold text-slate-900
                       transition hover:bg-slate-50"
          >
            Hesabın yok mu? Kayıt ol
            <span aria-hidden="true">→</span>
          </Link>

          <div className="text-center">
            <Link
              to="/forgot-password"
              className="text-sm text-slate-500 transition hover:text-slate-900"
            >
              Şifremi unuttum
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
