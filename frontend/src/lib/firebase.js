import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';

/**
 * Google ile giriş için Firebase istemcisi.
 *
 * Buradaki değerler tarayıcıya gidiyor ve gizli değil: Firebase Web API
 * anahtarı parola değil, projeyi tanımlayan bir kimlik. Asıl koruma Firebase
 * Console'daki yetkili alan adı listesinde.
 *
 * Dev ve production için ayrı proje kullanılıyor: yetkili alan adları farklı
 * ve test kayıtları gerçek kullanıcı verisine karışmamalı.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Değerler eksikse uygulama çökmüyor, yalnızca Google butonu devre dışı kalıyor.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId
);

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

/**
 * getAuth() yerine initializeAuth(): persistence ayarını kendimiz belirlemek
 * için. getAuth()'un varsayılanı ID token'ı popup kapanır kapanmaz
 * IndexedDB/localStorage'a yazıyor ve "token yalnızca httpOnly cookie'de
 * durur" kuralını deliyordu. inMemoryPersistence ile token yalnızca sekme
 * belleğinde kalıyor.
 *
 * popupRedirectResolver ayrıca veriliyor: initializeAuth kısayolun sağladığı
 * varsayılanları kendiliğinden kurmuyor.
 */
const auth = app
  ? initializeAuth(app, {
    persistence: inMemoryPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  })
  : null;

/**
 * Google giriş penceresini açar ve Firebase ID token'ını döndürür.
 *
 * Token burada saklanmıyor; çağıran taraf backend'e gönderiyor, oturum orada
 * kendi cookie'lerimizle kuruluyor. Firebase yalnızca "bu kişi bu Google
 * hesabının sahibi mi" sorusunu cevaplıyor.
 *
 * @returns {Promise<string>} Backend'in doğrulayacağı ID token
 * @throws  Kullanıcı pencereyi kapatırsa veya Firebase kapalıysa.
 */
export async function signInWithGoogle() {
  if (!auth) {
    throw new Error('Google ile giriş yapılandırılmamış (VITE_FIREBASE_* değerleri eksik).');
  }

  const provider = new GoogleAuthProvider();
  // Tek hesap açıksa Google onu sessizce seçiyor; bu parametre hesap seçim
  // ekranını her seferinde zorluyor.
  provider.setCustomParameters({ prompt: 'select_account' });

  const credential = await signInWithPopup(auth, provider);
  const idToken = await credential.user.getIdToken();

  // Bellekteki Firebase oturumu hemen kapatılıyor: tek kaynak bizim cookie'lerimiz.
  await signOut(auth).catch(() => { /* backend oturumu kuruldu, kritik değil */ });

  return idToken;
}
