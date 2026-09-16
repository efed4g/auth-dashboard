import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useResetPasswordMutation } from '../features/auth/authApi';
import { getErrorMessage } from '../lib/errors';
import AuthCard from '../components/layout/AuthCard';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  // Tek kullanımlık token; URL'den okunur, saklanmaz.
  const token = searchParams.get('token');
  const [form, setForm] = useState({ password: '', passwordConfirm: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password !== form.passwordConfirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    try {
      const response = await resetPassword({ token, newPassword: form.password }).unwrap();
      setMessage(response.message);
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      setError(getErrorMessage(err, 'Şifre güncellenemedi.'));
    }
  };

  if (!token) {
    return (
      <AuthCard title="Şifre sıfırlama">
        <Alert tone="error">
          Sıfırlama bağlantısı eksik veya hatalı. Lütfen e-postanızdaki bağlantıyı kullanın.
        </Alert>
        <div className="mt-6 text-center">
          <Link to="/forgot-password" className="text-sm font-semibold text-brand-600">
            Yeni bağlantı iste
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Yeni şifre belirle" subtitle="Yeni şifrenizi iki kez girin.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Alert tone="error">{error}</Alert>
        <Alert tone="success">{message}</Alert>

        <TextField
          label="Yeni şifre"
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
          label="Yeni şifre (tekrar)"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          required
          value={form.passwordConfirm}
          onChange={handleChange}
        />

        <Button type="submit" loading={isLoading}>Şifreyi güncelle</Button>
      </form>
    </AuthCard>
  );
}
