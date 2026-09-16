import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoginWithGoogleMutation } from '../features/auth/authApi';
import { signInWithGoogle, isFirebaseConfigured } from '../lib/firebase';
import { getErrorMessage } from '../lib/errors';
import Alert from './ui/Alert';

export default function GoogleButton({ onError }) {
  const navigate = useNavigate();
  const [loginWithGoogle, { isLoading }] = useLoginWithGoogleMutation();
  const [popupPending, setPopupPending] = useState(false);
  const [localError, setLocalError] = useState('');

  if (!isFirebaseConfigured) {
    return (
      <Alert tone="info">
        Google ile giriş bu ortamda yapılandırılmamış (VITE_FIREBASE_* değerleri eksik).
      </Alert>
    );
  }

  const handleClick = async () => {
    setLocalError('');
    setPopupPending(true);
    try {
      const idToken = await signInWithGoogle();
      await loginWithGoogle(idToken).unwrap();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      // Popup'ı kullanıcı kapattıysa hata gösterilmez.
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        return;
      }
      const message = err?.data
        ? getErrorMessage(err, 'Google ile giriş başarısız.')
        : err?.message || 'Google ile giriş başarısız.';
      setLocalError(message);
      onError?.(message);
    } finally {
      setPopupPending(false);
    }
  };

  const busy = popupPending || isLoading;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-2.5
                   text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300
                   transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
          <path fill="#EA4335" d="M12 10.2v3.9h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.2c1.9-1.7 3-4.3 3-7.3 0-.7-.1-1.4-.2-2H12z" />
          <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H3v2.7A10 10 0 0 0 12 22z" />
          <path fill="#FBBC05" d="M6.2 13.7a6 6 0 0 1 0-3.8V7.2H3a10 10 0 0 0 0 9l3.2-2.5z" />
          <path fill="#4285F4" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3 7.2l3.2 2.7C7 7.9 9.3 6.1 12 6.1z" />
        </svg>
        Google ile devam et
      </button>

      <Alert tone="error">{localError}</Alert>
    </div>
  );
}
