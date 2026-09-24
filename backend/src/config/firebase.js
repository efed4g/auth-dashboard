/**
 * Firebase Admin SDK sarmalayıcısı.
 *
 * Google girişinde tarayıcı Firebase'den bir ID token alıyor, backend de onu
 * burada doğruluyor. Ayrı dosyada olması Firebase yapılandırılmamışken
 * uygulamanın geri kalanının çalışmaya devam etmesini sağlıyor.
 */
const env = require('./env');

let firebaseApp = null;

// require'lar bilerek modül tepesinde değil: firebase-admin, ESM-only olan
// `jose` paketini çekiyor. Google girişi kapalıyken bu ağır SDK'yı hiç
// yüklememek zaten doğrusu; yan faydası Jest'in CommonJS çalışma zamanının
// testlerde ESM modülüne hiç dokunmaması.
if (env.firebase.enabled) {
  const { initializeApp, cert, getApps } = require('firebase-admin/app');

  // getApps() kontrolü, modül birden fazla kez yüklendiğinde (nodemon, test)
  // "app already exists" hatasını önlüyor.
  firebaseApp = getApps().length
    ? getApps()[0]
    : initializeApp({
      credential: cert({
        projectId: env.firebase.projectId,
        clientEmail: env.firebase.clientEmail,
        privateKey: env.firebase.privateKey,
      }),
    });
} else {
  // Eksik yapılandırma bütün uygulamayı durdurmamalı; yalnızca Google girişi kapalı.
  console.warn('[firebase] FIREBASE_* değişkenleri eksik — Google ile giriş devre dışı.');
}

/**
 * Tarayıcıdan gelen Firebase ID token'ını doğrular.
 *
 * @param   {string} idToken
 * @returns {Promise<object>} Çözülmüş claim'ler (uid, email, email_verified...)
 * @throws  Token geçersizse veya Firebase kapalıysa.
 */
function verifyIdToken(idToken) {
  if (!firebaseApp) {
    throw new Error('Firebase yapılandırılmamış.');
  }
  // Buraya yalnızca firebaseApp kurulmuşken gelinebiliyor, yani SDK zaten
  // yüklenmiş durumda; require önbellekten dönüyor.
  const { getAuth } = require('firebase-admin/auth');
  return getAuth(firebaseApp).verifyIdToken(idToken);
}

module.exports = {
  isEnabled: () => Boolean(firebaseApp),
  verifyIdToken,
};
