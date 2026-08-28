import { Router } from 'express';
import { authenticate } from '../../middleware/authentication.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './controller.js';

export const paymentRouter = Router();
paymentRouter.use(authenticate);
paymentRouter.post('/demo-data', asyncHandler(controller.generateDemoData));
paymentRouter.get('/', asyncHandler(controller.listPayments));
paymentRouter.get('/stats', asyncHandler(controller.getPaymentStats));
paymentRouter.get('/:id', asyncHandler(controller.getPayment));
