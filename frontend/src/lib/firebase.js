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
 * Passport + OAuth2 yerine Firebase tercih ettim: OAuth akışının yönlendirme
 * ve callback tarafını Firebase yönettiği için backend'de yalnızca gelen
 * token'ı doğrulamak kalıyor.
 *
 * Buradaki değerler tarayıcıya gidiyor ve gizli değil; Firebase Web API
 * anahtarı bir parola değil, projeyi tanımlayan bir kimlik. Asıl koruma
 * Firebase Console'daki yetkili alan adı listesinde.
 *
 * Dev ve production için ayrı Firebase projesi kullanılıyor: yetkili alan
 * adları farklı (localhost / gerçek alan adı) ve test kayıtlarının gerçek
 * kullanıcı verisine karışmaması gerekiyor.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Değerler eksikse uygulama çökmüyor, yalnızca Google butonu devre dışı
// kalıyor. Projeyi Firebase hesabı olmadan çalıştırabilmek için.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId
);

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

/**
 * Kısayol olan getAuth() yerine initializeAuth() kullanılmasının sebebi:
 * persistence ayarını kendimiz belirlemek.
 *
 * getAuth()'un varsayılanı
 * [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]
 * zinciri. Yani Google ID token'ı popup kapanır kapanmaz tarayıcı deposuna
 * yazılıyor. Oturumu zaten kendi httpOnly cookie'lerimizle yönettiğimiz için
 * buna ihtiyacımız yok ve "token yalnızca httpOnly cookie'de durur" kuralını
 * fiilen deliyordu.
 *
 * inMemoryPersistence ile token yalnızca sekme belleğinde kalıyor; diske,
 * localStorage'a ya da IndexedDB'ye hiç yazılmıyor. popupRedirectResolver'ı
 * ayrıca vermek gerekiyor, çünkü initializeAuth kısayolun sağladığı
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
 * Token burada saklanmıyor; çağıran taraf doğrudan backend'e gönderiyor,
 * oturum orada kendi cookie'lerimizle kuruluyor. Yani Firebase yalnızca
 * "bu kişi gerçekten bu Google hesabının sahibi" sorusunu cevaplıyor,
 * oturum yönetimine hiç karışmıyor.
 *
 * @returns {Promise<string>} Backend'in doğrulayacağı ID token
 * @throws  Kullanıcı pencereyi kapatırsa veya Firebase kapalıysa hata fırlatır.
 */
export async function signInWithGoogle() {
  if (!auth) {
    throw new Error('Google ile giriş yapılandırılmamış (VITE_FIREBASE_* değerleri eksik).');
  }

  const provider = new GoogleAuthProvider();
  // prompt: 'select_account' — tarayıcıda tek hesap açıksa Google onu sessizce
  // seçiyor. Birden fazla hesabı olan kullanıcı hangisiyle giriş yaptığını
  // seçemiyor; bu parametre hesap seçim ekranını her seferinde zorluyor.
  provider.setCustomParameters({ prompt: 'select_account' });

  const credential = await signInWithPopup(auth, provider);
  const idToken = await credential.user.getIdToken();

  // Bellekteki Firebase oturumu da hemen kapatılır: tek kaynak bizim cookie'lerimiz.
  await signOut(auth).catch(() => { /* backend oturumu kuruldu, kritik değil */ });

  return idToken;
}
