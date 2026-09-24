import { useState } from 'react';
import { useReactivateAccountMutation } from '../features/auth/authApi';
import { getErrorMessage } from '../lib/errors';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

/**
 * Devre dışı bırakılmış hesabın gördüğü ekran; uygulamanın geri kalanının
 * yerine gösteriliyor (bkz. ProtectedRoute). Asıl engel backend'deki
 * requireActive middleware'i.
 */
export default function InactiveAccountPage() {
  const [reactivate, { isLoading }] = useReactivateAccountMutation();
  const [error, setError] = useState('');

  const handleReactivate = async () => {
    setError('');
    try {
      await reactivate().unwrap();
      // Yönlendirme gerekmiyor: Session tazelenince isActive true geliyor ve
      // ProtectedRoute bu ekranı göstermeyi bırakıyor.
    } catch (err) {
      setError(getErrorMessage(err, 'Hesap etkinleştirilemedi.'));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-900/5">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100">
          <span className="text-2xl" aria-hidden="true">⏸</span>
        </div>

        <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900">
          Hesabınız devre dışı
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Verileriniz silinmedi, olduğu gibi duruyor. Hesabınızı yeniden
          etkinleştirdiğinizde profiliniz ve ayarlarınız yerinde olacak.
        </p>

        <div className="mt-6">
          <Alert tone="error">{error}</Alert>
        </div>

        <div className="mt-6">
          <Button loading={isLoading} onClick={handleReactivate}>
            Hesabımı yeniden etkinleştir
          </Button>
        </div>
      </div>
    </div>
  );
}
