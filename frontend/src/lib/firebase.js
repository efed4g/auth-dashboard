import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

// Dev ve production ayrı Firebase projesi/web app kullanır.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId
);

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

/**
 * Google popup'ını açar ve Firebase ID token'ını döner.
 * Token saklanmaz: doğrudan backend'e gönderilir, oturum orada httpOnly
 * cookie ile kurulur ve Firebase oturumu kapatılır.
 */
export async function signInWithGoogle() {
  if (!app) {
    throw new Error('Google ile giriş yapılandırılmamış (VITE_FIREBASE_* değerleri eksik).');
  }

  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const credential = await signInWithPopup(auth, provider);
  const idToken = await credential.user.getIdToken();

  await signOut(auth).catch(() => { /* backend oturumu kuruldu, kritik değil */ });

  return idToken;
}
