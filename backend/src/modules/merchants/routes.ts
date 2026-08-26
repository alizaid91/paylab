import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { authenticate } from '../../middleware/authentication.js';
import { MerchantService } from './service.js';
import { createMerchantController, type MerchantServiceLike } from './controller.js';

export function createMerchantRouter(service: MerchantServiceLike = new MerchantService()) {
  const merchantRouter = Router();
  const controller = createMerchantController(service);
  merchantRouter.use(authenticate);
  merchantRouter.get('/', asyncHandler(controller.getMerchant));
  merchantRouter.put('/', asyncHandler(controller.updateMerchant));
  return merchantRouter;
}

export const merchantRouter = createMerchantRouter();
