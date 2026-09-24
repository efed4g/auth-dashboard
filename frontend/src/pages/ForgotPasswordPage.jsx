import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForgotPasswordMutation } from '../features/auth/authApi';
import { getErrorMessage } from '../lib/errors';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

/**
 * Şifre sıfırlama isteği sayfası.
 *
 * Anlatım dili backend'in hesap varlığını gizleme kararına uyuyor: "gönderildi"
 * değil "kayıtlıysa gönderildi" deniyor.
 */

// Etiketler sr-only: placeholder tek başına ekran okuyucular için yeterli bir
// etiket sayılmıyor ve yazmaya başlayınca kayboluyor.
const inputClass =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 transition focus:border-brand-500 focus:bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export default function ForgotPasswordPage() {
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      // Backend, hesabın varlığını sızdırmamak için hep aynı mesajı döner.
      const response = await forgotPassword({ email }).unwrap();
      setMessage(response.message);
    } catch (err) {
      setError(getErrorMessage(err, 'İstek gönderilemedi.'));
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-white px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-center text-3xl font-bold tracking-tight text-slate-900">
          Şifremi unuttum
        </h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-600">
          Kayıtlı e-posta adresine sıfırlama bağlantısı gönderelim.
        </p>

        <div className="mt-8 space-y-4">
          <Alert tone="error">{error}</Alert>
          <Alert tone="success">{message}</Alert>
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
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="E-posta adresi"
              className={inputClass}
            />
          </div>

          <div className="pt-1">
            <Button type="submit" loading={isLoading} className="py-3">
              Bağlantı gönder
            </Button>
          </div>
        </form>

        {/* Herkese gösteriliyor: yalnızca ilgili kullanıcıya göstermek adresin
            kayıtlı olduğunu ve hangi yöntemle açıldığını ele verirdi. */}
        <p className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
          Hesabını Google ile açtıysan şifren yoktur; sıfırlama bağlantısı gelmez.
          Google ile giriş yap, ardından “Hesap güvenliği” bölümünden şifre
          belirleyebilirsin.
        </p>

        <div className="mt-8">
          <Link
            to="/login"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border
                       border-slate-200 py-3 text-sm font-semibold text-slate-900
                       transition hover:bg-slate-50"
          >
            <span aria-hidden="true">←</span>
            Giriş ekranına dön
          </Link>
        </div>
      </div>
    </div>
  );
}
