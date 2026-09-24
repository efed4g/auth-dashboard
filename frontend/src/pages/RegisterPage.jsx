import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRegisterMutation } from '../features/auth/authApi';
import { getErrorMessage } from '../lib/errors';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import GoogleButton from '../components/GoogleButton';

/**
 * Kayıt sayfası.
 *
 * Kayıt sonrası oturum açılmıyor (önce e-posta doğrulaması gerekiyor), bu
 * yüzden yönlendirme yerine ekranda bilgilendirme mesajı gösteriliyor.
 */

// Backend'deki kuralla aynı değer; burada sadece form gönderilmeden geri
// bildirim verebilmek için. Asıl kontrol sunucuda.
const MIN_PASSWORD_LENGTH = 8;

// Etiketler sr-only: placeholder tek başına ekran okuyucular için yeterli bir
// etiket sayılmıyor ve yazmaya başlayınca kayboluyor.
const inputClass =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 transition focus:border-brand-500 focus:bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export default function RegisterPage() {
  const [register, { isLoading }] = useRegisterMutation();
  const [form, setForm] = useState({ email: '', password: '', passwordConfirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    // Yazım hatası kontrolü; sunucuya gönderilmesine gerek yok.
    if (form.password !== form.passwordConfirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    try {
      const response = await register({
        email: form.email,
        password: form.password,
      }).unwrap();
      // Mesaj sunucudan: "şimdi ne yapılmalı" bilgisi akışı bilen tarafta kalsın.
      setSuccess(response.message);
      setForm({ email: '', password: '', passwordConfirm: '' });
    } catch (err) {
      setError(getErrorMessage(err, 'Kayıt oluşturulamadı.'));
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-white px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-center text-3xl font-bold tracking-tight text-slate-900">
          Kayıt ol
        </h1>

        <div className="mt-8 space-y-4">
          <Alert tone="error">{error}</Alert>
          <Alert tone="success">{success}</Alert>
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
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={form.password}
              onChange={handleChange}
              placeholder={`Şifre (en az ${MIN_PASSWORD_LENGTH} karakter)`}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="passwordConfirm" className="sr-only">Şifre (tekrar)</label>
            <input
              id="passwordConfirm"
              name="passwordConfirm"
              type="password"
              autoComplete="new-password"
              required
              value={form.passwordConfirm}
              onChange={handleChange}
              placeholder="Şifre (tekrar)"
              className={inputClass}
            />
          </div>

          <div className="pt-1">
            <Button type="submit" loading={isLoading} className="py-3">
              Hesap oluştur
            </Button>
          </div>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs text-slate-400">veya</span>
          </div>
        </div>

        <GoogleButton />

        <div className="mt-8">
          <Link
            to="/login"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border
                       border-slate-200 py-3 text-sm font-semibold text-slate-900
                       transition hover:bg-slate-50"
          >
            Zaten hesabın var mı? Giriş yap
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
