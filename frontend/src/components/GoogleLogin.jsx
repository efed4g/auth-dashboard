import React from 'react';
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import app from '../helpers/firebase';

function GoogleLogin({ onLoginSuccess }) {
  const handleGoogleLogin = async () => {
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const apiUrl = import.meta.env.VITE_API_URL;
      const res = await fetch(`${apiUrl}/auth/firebase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (res.ok) {
        onLoginSuccess && onLoginSuccess();
      } else {
        alert(data.error || "Google ile girişte sorun oluştu.");
      }
    } catch (err) {
      alert("Google login başarısız: " + err.message);
    }
  };

  return (
    <button onClick={handleGoogleLogin} className="google-login-button">
      Google ile Giriş Yap
    </button>
  );
}

export default GoogleLogin;