import { useState } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../features/auth/authSlice';
import { useNavigate } from 'react-router-dom';
import {
  useSetPasswordMutation,
  useDeactivateAccountMutation,
  useDeleteAccountMutation,
} from '../features/auth/authApi';
import { getErrorMessage } from '../lib/errors';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

/**
 * Hesap güvenliği sayfası.
 *
 * Tek form iki işi görüyor: şifresiz (Google) hesaba şifre eklemek ve mevcut
 * şifreyi değiştirmek. Hangi durumda olunduğu hasPassword'dan anlaşılıyor.
 */

const MIN_PASSWORD_LENGTH = 8;

// Gönderim sonrası şifre alanları ekranda dolu kalmasın.
const EMPTY_FORM = { currentPassword: '', newPassword: '', newPasswordConfirm: '' };

export default function SecurityPage() {
  const user = useSelector(selectUser);
  const [setPassword, { isLoading }] = useSetPasswordMutation();

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Her bölüm kendi hata durumunu tutuyor; aynı state paylaşılsaydı birinin
  // hatası diğerinin ekranında görünürdü.
  const [deactivate, { isLoading: deactivating }] = useDeactivateAccountMutation();
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deactivateError, setDeactivateError] = useState('');

  const navigate = useNavigate();
  const [deleteAccount, { isLoading: deleting }] = useDeleteAccountMutation();
  const [deleteEmail, setDeleteEmail] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Hash istemciye hiç gönderilmiyor, varlığı boolean olarak taşınıyor
  // (bkz. User.toPublicJSON).
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
      // Şifresiz hesapta boş alan göndermek sunucuda gereksiz hata üretirdi.
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

  // Yönlendirme gerekmiyor: /auth/me yeniden çekilince ProtectedRoute
  // etkinleştirme ekranını kendiliğinden gösteriyor.
  const handleDeactivate = async (event) => {
    event.preventDefault();
    setDeactivateError('');
    try {
      await deactivate({ confirmEmail }).unwrap();
    } catch (err) {
      setDeactivateError(getErrorMessage(err, 'Hesap devre dışı bırakılamadı.'));
    }
  };

  // Geri dönüşü olmadığı için tarayıcının onay penceresi de araya giriyor.
  const handleDelete = async (event) => {
    event.preventDefault();
    setDeleteError('');

    if (!window.confirm('Hesabınız ve tüm verileriniz kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?')) {
      return;
    }

    try {
      await deleteAccount({ confirmEmail: deleteEmail, acknowledged }).unwrap();
      navigate('/login', { replace: true });
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Hesap silinemedi.'));
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

      {/* Amber: geri dönüşü var. Kırmızı: yok. Renk ve sıralama, yanlışlıkla
          ağır olanın seçilmesini zorlaştırmak için. */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-amber-200">
        <h2 className="text-sm font-semibold text-amber-800">Hesabı devre dışı bırak</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Hesabınız kapatılır ve uygulamayı kullanamazsınız. Verileriniz
          silinmez; istediğiniz zaman giriş yapıp yeniden etkinleştirebilirsiniz.
        </p>

        <form onSubmit={handleDeactivate} className="mt-5 max-w-sm space-y-4">
          <Alert tone="error">{deactivateError}</Alert>

          <TextField
            label="Onaylamak için e-posta adresinizi yazın"
            name="confirmEmail"
            type="email"
            required
            value={confirmEmail}
            onChange={(event) => setConfirmEmail(event.target.value)}
            hint={user?.email}
          />

          <Button
            type="submit"
            variant="danger"
            loading={deactivating}
            // Asıl kontrol sunucuda; bu yalnızca yanlışlıkla gönderimi engelliyor.
            disabled={confirmEmail.trim().toLowerCase() !== user?.email}
          >
            Hesabımı devre dışı bırak
          </Button>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-red-300">
        <h2 className="text-sm font-semibold text-red-800">Hesabı kalıcı olarak sil</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Hesabınız, profiliniz ve tüm oturum kayıtlarınız veritabanından
          silinir. <strong className="font-semibold text-red-800">Bu işlem geri
          alınamaz.</strong> Sadece bir süre ara vermek istiyorsanız yukarıdaki
          devre dışı bırakma seçeneğini kullanın.
        </p>

        <form onSubmit={handleDelete} className="mt-5 max-w-sm space-y-4">
          <Alert tone="error">{deleteError}</Alert>

          <TextField
            label="Onaylamak için e-posta adresinizi yazın"
            name="deleteEmail"
            type="email"
            required
            value={deleteEmail}
            onChange={(event) => setDeleteEmail(event.target.value)}
            hint={user?.email}
          />

          {/* Geri alınamaz işlem için ikinci bir onay katmanı. */}
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-0.5 size-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            Verilerimin kalıcı olarak silineceğini ve geri alınamayacağını anlıyorum.
          </label>

          <Button
            type="submit"
            variant="danger"
            loading={deleting}
            disabled={!acknowledged || deleteEmail.trim().toLowerCase() !== user?.email}
          >
            Hesabımı kalıcı olarak sil
          </Button>
        </form>
      </section>
    </div>
  );
}
