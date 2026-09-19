import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRegisterMutation } from '../features/auth/authApi';
import { getErrorMessage } from '../lib/errors';
import AuthCard from '../components/layout/AuthCard';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import GoogleButton from '../components/GoogleButton';

/**
 * Kayıt sayfası.
 *
 * Kayıt sonrası oturum açılmıyor; kullanıcı e-posta doğrulaması yapana kadar
 * giriş yapamıyor. Bu yüzden başka sayfaya yönlendirme yerine ekranda
 * bilgilendirme mesajı gösteriliyor.
 */

// Backend'deki kuralla aynı değer. Burada tekrarlanmasının sebebi kullanıcıya
// form gönderilmeden geri bildirim verebilmek; asıl kontrol yine sunucuda.
const MIN_PASSWORD_LENGTH = 8;

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

    // Şifre tekrarı yalnızca istemci tarafında kontrol ediliyor; sunucuya
    // gönderilmesine gerek yok, bu bir yazım hatası kontrolü.
    if (form.password !== form.passwordConfirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    try {
      const response = await register({
        email: form.email,
        password: form.password,
      }).unwrap();
      // Mesaj sunucudan geliyor, burada sabit metin yazılmıyor: "şimdi ne
      // yapılmalı" bilgisi akışı bilen tarafta kalsın.
      setSuccess(response.message);
      // Form temizleniyor ki başarı mesajının altında dolu alanlar kalıp
      // kullanıcı tekrar gönderdiğini sanmasın.
      setForm({ email: '', password: '', passwordConfirm: '' });
    } catch (err) {
      setError(getErrorMessage(err, 'Kayıt oluşturulamadı.'));
    }
  };

  return (
    <AuthCard
      title="Kayıt ol"
      subtitle="E-posta ve şifrenizle yeni bir hesap oluşturun."
      footer={
        <>
          Zaten hesabınız var mı?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Giriş yapın
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Alert tone="error">{error}</Alert>
        <Alert tone="success">{success}</Alert>

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
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={form.password}
          onChange={handleChange}
          hint={`En az ${MIN_PASSWORD_LENGTH} karakter.`}
        />

        <TextField
          label="Şifre (tekrar)"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          required
          value={form.passwordConfirm}
          onChange={handleChange}
        />

        <Button type="submit" loading={isLoading}>Hesap oluştur</Button>
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
