const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const logger = require('./utils/logger');
const routes = require('./routes');
const requestLogger = require('./middleware/requestLogger.middleware');
const { verifyCsrf } = require('./middleware/csrf.middleware');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

const app = express();

// Rate limit'in gerçek istemci IP'sini görmesi için (reverse proxy arkasında).
if (env.trustProxy) {
  app.set('trust proxy', env.trustProxy);
}
app.disable('x-powered-by');

app.use(requestLogger);

// credentials: true + frontend'de credentials: 'include' — cookie'lerin
// farklı origin'e gidip gelebilmesi için ikisi de gerekli.
const allowedOrigins = env.frontendUrl.split(',').map((origin) => origin.trim());
app.use(cors({
  origin(origin, callback) {
    // Origin göndermeyen istemciler (curl, sunucudan sunucuya) engellenmez.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Hata fırlatmak yerine başlıkları hiç göndermiyoruz: tarayıcı yine
    // engeller, ama her denemede 500 + stack trace loglanmaz.
    logger.warn('CORS: izin verilmeyen origin reddedildi.', { origin });
    return callback(null, false);
  },
  credentials: true,
}));

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use('/api', verifyCsrf);
app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
