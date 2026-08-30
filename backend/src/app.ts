import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { checkDatabaseConnection } from './db/client.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { sendError, sendSuccess } from './utils/api-response.js';
import { authRouter } from './modules/auth/routes.js';
import { merchantRouter } from './modules/merchants/routes.js';
import { createAuthRouter } from './modules/auth/routes.js';
import { createMerchantRouter } from './modules/merchants/routes.js';
import type { AuthServiceLike } from './modules/auth/controller.js';
import type { MerchantServiceLike } from './modules/merchants/controller.js';
import { paymentRouter } from './modules/payments/routes.js';
import { analyticsRouter } from './modules/analytics/routes.js';
import { opportunityRouter } from './modules/opportunities/routes.js';
import { strategyRouter } from './modules/strategies/routes.js';
import { policyRouter } from './modules/policies/routes.js';
import { executionRouter } from './modules/executions/routes.js';
import { recoveryCampaignRouter } from './modules/recovery-campaigns/routes.js';
import { auditLogRouter } from './modules/audit-logs/routes.js';

export function createApp(dependencies?: {
  authService?: AuthServiceLike;
  merchantService?: MerchantServiceLike;
}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN }));
  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
  app.use(requestLogger);
  app.use('/api/auth', dependencies?.authService ? createAuthRouter(dependencies.authService) : authRouter);
  app.use('/api/merchant', dependencies?.merchantService ? createMerchantRouter(dependencies.merchantService) : merchantRouter);
  app.use('/api/payments', paymentRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/opportunities', opportunityRouter);
  app.use('/api/strategies', strategyRouter);
  app.use('/api', policyRouter);
  app.use('/api/executions', executionRouter);
  app.use('/api/recovery-campaigns', recoveryCampaignRouter);
  app.use('/api/audit-logs', auditLogRouter);

  app.get('/health', (_req, res) => {
    sendSuccess(res, { status: 'ok' });
  });

  app.get('/ready', async (_req, res) => {
    try {
      await checkDatabaseConnection();
      sendSuccess(res, { status: 'ready' });
    } catch {
      sendError(res, 'DATABASE_UNAVAILABLE', 'Database is unavailable', 503);
    }
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
