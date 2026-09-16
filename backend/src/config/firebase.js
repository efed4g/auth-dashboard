const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const env = require('./env');

let firebaseApp = null;

if (env.firebase.enabled) {
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
  console.warn('[firebase] FIREBASE_* değişkenleri eksik — Google ile giriş devre dışı.');
}

function verifyIdToken(idToken) {
  if (!firebaseApp) {
    throw new Error('Firebase yapılandırılmamış.');
  }
  return getAuth(firebaseApp).verifyIdToken(idToken);
}

module.exports = {
  isEnabled: () => Boolean(firebaseApp),
  verifyIdToken,
};
