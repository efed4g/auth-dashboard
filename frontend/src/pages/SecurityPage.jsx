import { useState } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../features/auth/authSlice';
import { useSetPasswordMutation } from '../features/auth/authApi';
import { getErrorMessage } from '../lib/errors';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

/**
 * Hesap güvenliği sayfası.
 *
 * Tek bir form iki işi görüyor: Google ile açılmış şifresiz hesaba şifre
 * eklemek ve mevcut şifreyi değiştirmek. Hangi durumda olunduğu kullanıcının
 * hasPassword bilgisinden anlaşılıyor; iki ayrı sayfa yapmak yerine aynı
 * formu uyarlamak, arka uçta da tek bir uçla karşılanıyor.
 */

const MIN_PASSWORD_LENGTH = 8;

// Form başarıyla gönderildikten sonra sıfırlamak için sabit başlangıç değeri.
// Şifre alanlarının ekranda dolu kalmaması gerekiyor.
const EMPTY_FORM = { currentPassword: '', newPassword: '', newPasswordConfirm: '' };

export default function SecurityPage() {
  const user = useSelector(selectUser);
  const [setPassword, { isLoading }] = useSetPasswordMutation();

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Formun hangi biçimde görüneceğini belirleyen tek bilgi. Sunucudan geliyor;
  // şifre hash'i istemciye hiç gönderilmediği için varlığı boolean olarak
  // taşınıyor (bkz. User.toPublicJSON).
  const hasPassword = user?.hasPassword;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (form.newPassword !== form.newPasswordConfirm) {
      setError('Yeni şifreler eşleşmiyor.');
      return;
    }

    try {
      // Mevcut şifre yalnızca gerçekten varsa gönderiliyor. Şifresiz hesapta
      // boş bir alan göndermek sunucuda gereksiz doğrulama hatası üretirdi.
      const response = await setPassword({
        ...(hasPassword ? { currentPassword: form.currentPassword } : {}),
        newPassword: form.newPassword,
      }).unwrap();
      setSuccess(response.message);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(getErrorMessage(err, 'Şifre kaydedilemedi.'));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hesap güvenliği</h1>
        <p className="mt-1 text-sm text-slate-600">
          {hasPassword
            ? 'Şifreni değiştirebilirsin. Değişiklikten sonra diğer cihazlardaki oturumlar kapanır.'
            : 'Hesabın Google ile açılmış, henüz bir şifren yok. Şifre belirlersen e-posta ve şifreyle de giriş yapabilirsin.'}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-[1fr_280px]">
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5"
        >
          <Alert tone="error">{error}</Alert>
          <Alert tone="success">{success}</Alert>

          {hasPassword && (
            <TextField
              label="Mevcut şifre"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={form.currentPassword}
              onChange={handleChange}
            />
          )}

          <TextField
            label={hasPassword ? 'Yeni şifre' : 'Şifre'}
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={form.newPassword}
            onChange={handleChange}
            hint={`En az ${MIN_PASSWORD_LENGTH} karakter.`}
          />

          <TextField
            label={hasPassword ? 'Yeni şifre (tekrar)' : 'Şifre (tekrar)'}
            name="newPasswordConfirm"
            type="password"
            autoComplete="new-password"
            required
            value={form.newPasswordConfirm}
            onChange={handleChange}
          />

          <Button type="submit" loading={isLoading}>
            {hasPassword ? 'Şifreyi değiştir' : 'Şifre belirle'}
          </Button>
        </form>

        <aside className="space-y-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
          <h2 className="text-sm font-semibold text-slate-900">Giriş yöntemlerin</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <span className={user?.hasGoogleAccount ? 'text-emerald-600' : 'text-slate-300'}>
                ●
              </span>
              Google {user?.hasGoogleAccount ? 'bağlı' : 'bağlı değil'}
            </li>
            <li className="flex items-center gap-2">
              <span className={hasPassword ? 'text-emerald-600' : 'text-slate-300'}>●</span>
              E-posta + şifre {hasPassword ? 'aktif' : 'yok'}
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
