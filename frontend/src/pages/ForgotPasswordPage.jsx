import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForgotPasswordMutation } from '../features/auth/authApi';
import { getErrorMessage } from '../lib/errors';
import AuthCard from '../components/layout/AuthCard';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

/**
 * Şifre sıfırlama isteği sayfası.
 *
 * Sayfanın anlatım dili, backend'in hesap varlığını gizleme kararına göre
 * kuruldu: kullanıcıya "gönderildi" değil "kayıtlıysa gönderildi" deniyor
 * ve Google hesapları için açıklama sabit metin olarak herkese gösteriliyor.
 */
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
    <AuthCard
      title="Şifremi unuttum"
      subtitle="Kayıtlı e-posta adresinize sıfırlama bağlantısı gönderelim."
      footer={
        <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Giriş ekranına dön
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Alert tone="error">{error}</Alert>
        <Alert tone="success">{message}</Alert>

        <TextField
          label="E-posta"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ornek@firma.com"
        />

        <Button type="submit" loading={isLoading}>Bağlantı gönder</Button>
      </form>

      {/* Bu açıklama koşula bağlı değil, herkese gösteriliyor. "Bu hesap
          Google ile açılmış" uyarısını yalnızca ilgili kullanıcıya göstermek,
          adresin kayıtlı olduğunu ve hangi yöntemle açıldığını ele verirdi. */}
      <p className="mt-5 text-xs leading-relaxed text-slate-500">
        Hesabını Google ile açtıysan şifren yoktur; sıfırlama bağlantısı gelmez.
        Google ile giriş yap, ardından “Hesap güvenliği” bölümünden şifre belirleyebilirsin.
      </p>
    </AuthCard>
  );
}
