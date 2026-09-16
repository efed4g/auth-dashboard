const path = require('path');
const dotenv = require('dotenv');

const NODE_ENV = process.env.NODE_ENV || 'development';
const envFileName = NODE_ENV === 'production' ? '.env.production' : '.env.development';
const envFilePath = path.resolve(__dirname, '..', '..', envFileName);

dotenv.config({ path: envFilePath });

const isProduction = NODE_ENV === 'production';

const REQUIRED_KEYS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'FRONTEND_URL',
  'BACKEND_URL',
];

const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Eksik ortam değişkeni: ${missing.join(', ')}. ` +
    `Beklenen dosya: ${envFilePath} (örnek için .env.example)`
  );
}

// Aynı secret kullanılırsa access token refresh yerine geçebilir.
if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET ve JWT_REFRESH_SECRET aynı olamaz.');
}

// Firebase opsiyonel: eksikse sunucu çalışır, sadece Google girişi kapalı olur.
const firebaseKeys = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
const firebaseEnabled = firebaseKeys.every((key) => Boolean(process.env[key]));

module.exports = {
  nodeEnv: NODE_ENV,
  isProduction,
  envFilePath,
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  databaseLogging: process.env.DB_LOGGING === 'true',
  frontendUrl: process.env.FRONTEND_URL,
  backendUrl: process.env.BACKEND_URL,
  trustProxy: process.env.TRUST_PROXY || (isProduction ? '1' : false),

  jwt: {
    accessSecret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshTtl: process.env.REFRESH_TOKEN_TTL || '7d',
  },

  cookie: {
    secure: isProduction,
    // Aynı site deploy'da lax/strict, farklı domainlerde none gerekir.
    sameSite: process.env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax'),
    domain: process.env.COOKIE_DOMAIN || undefined,
  },

  firebase: {
    enabled: firebaseEnabled,
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined,
  },
};
