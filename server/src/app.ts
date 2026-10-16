import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRoutes } from './routes/authRoutes.js';
import { config, hasFirebaseAdminConfig, hasPaymentProviderConfig, hasVtpassConfig, hasFlutterwaveSandboxConfig, hasPaymentEncryptionConfig } from './config.js';
import { databaseHealth } from './database.js';
import { firebaseAdminReady } from './auth.js';
import { HttpError } from './errors.js';
import { paymentRoutes } from './routes/paymentRoutes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: config.WEB_ORIGIN, methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Authorization', 'Content-Type', 'verif-hash'] }));
  app.use(express.json({ limit: '20kb' }));
  app.use('/api/auth', (_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', async (_request, response) => {
    const database = await databaseHealth();
    response.json({
      service: 'meld-api',
      status: 'ok',
      readiness: {
        database,
        firebase: firebaseAdminReady() ? 'configured' : 'not_configured',
        email: hasFirebaseAdminConfig() ? 'firebase_managed' : 'not_configured',
        payments: hasPaymentProviderConfig() ? 'sandbox_ready' : 'not_configured',
        paymentSetup: {
          vtpass: hasVtpassConfig() ? 'configured' : 'not_configured',
          flutterwave: hasFlutterwaveSandboxConfig() ? 'configured' : 'not_configured',
          secureStorage: hasPaymentEncryptionConfig() ? 'configured' : 'not_configured',
        },
      },
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/payments', (_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  }, paymentRoutes);
  app.use('/api', (_request, response) => response.status(404).json({ error: { code: 'NOT_FOUND', message: 'This Meld service route does not exist.' } }));

  const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof HttpError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    if (error instanceof SyntaxError && 'body' in error) {
      response.status(400).json({ error: { code: 'INVALID_JSON', message: 'The request could not be read. Check the submitted information.' } });
      return;
    }
    // Keep raw request/provider/database errors out of logs; they may contain private configuration.
    console.error('Unhandled Meld API error', { name: error instanceof Error ? error.name : 'UnknownError' });
    response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Meld could not complete that request. Try again later.' } });
  };
  app.use(errorHandler);
  return app;
}
