import { Router } from 'express';
import { authenticate } from '../../middleware/authentication.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './controller.js';

export const analyticsRouter = Router();
analyticsRouter.use(authenticate);
analyticsRouter.get('/overview', asyncHandler(controller.overview));
analyticsRouter.get('/payment-methods', asyncHandler(controller.paymentMethods));
analyticsRouter.get('/failures', asyncHandler(controller.failures));
analyticsRouter.get('/trends', asyncHandler(controller.trends));
