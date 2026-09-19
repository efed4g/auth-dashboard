/**
 * Firebase Admin SDK sarmalayıcısı.
 *
 * Google ile girişte tarayıcı Firebase'den bir ID token alıyor, backend de o
 * token'ı burada doğruluyor. Admin SDK'nın doğrudan controller içinde
 * kurulmaması kasıtlı: Firebase yapılandırılmamışsa uygulamanın geri kalanı
 * çalışmaya devam etmeli, bu dosya da "kapalı" moda düşebilmeli.
 */
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const env = require('./env');

let firebaseApp = null;

if (env.firebase.enabled) {
  // getApps() kontrolü, modülün birden fazla kez yüklendiği durumlarda
  // (nodemon yeniden başlatması, test) "app already exists" hatasını önlüyor.
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
  // Hata fırlatmıyoruz: eksik Firebase yapılandırması bütün uygulamayı
  // durdurmamalı. Sadece uyarı verip Google girişini kapalı bırakıyoruz.
  console.warn('[firebase] FIREBASE_* değişkenleri eksik — Google ile giriş devre dışı.');
}

/**
 * Tarayıcıdan gelen Firebase ID token'ını doğrular.
 *
 * @param   {string} idToken  İstemcinin gönderdiği ID token
 * @returns {Promise<object>} Çözülmüş claim'ler (uid, email, email_verified...)
 * @throws  Token geçersiz/süresi dolmuşsa veya Firebase kapalıysa hata fırlatır.
 */
function verifyIdToken(idToken) {
  if (!firebaseApp) {
    throw new Error('Firebase yapılandırılmamış.');
  }
  return getAuth(firebaseApp).verifyIdToken(idToken);
}

module.exports = {
  // Controller, Google ucuna gelen isteği reddetmeden önce buna bakıyor.
  isEnabled: () => Boolean(firebaseApp),
  verifyIdToken,
};
