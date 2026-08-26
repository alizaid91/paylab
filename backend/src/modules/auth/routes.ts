import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './controller.js';
import { authenticate } from '../../middleware/authentication.js';
import { AuthService } from './service.js';
import { createAuthController, type AuthServiceLike } from './controller.js';
import { env } from '../../config/env.js';
import { rateLimit } from '../../middleware/rate-limit.js';

export function createAuthRouter(service: AuthServiceLike = new AuthService()) {
  const authRouter = Router();
  const controller = createAuthController(service);
  const authRateLimit = rateLimit('auth', env.AUTH_RATE_LIMIT_WINDOW_MS, env.AUTH_RATE_LIMIT_MAX);
  authRouter.post('/register', authRateLimit, asyncHandler(controller.register));
  authRouter.post('/login', authRateLimit, asyncHandler(controller.login));
  authRouter.get('/me', authenticate, asyncHandler(controller.me));
  return authRouter;
}

export const authRouter = createAuthRouter();
