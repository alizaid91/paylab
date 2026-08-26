import type { RequestHandler } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import { MerchantService } from './service.js';
import { merchantUpdateSchema } from '../auth/validation.js';

export type MerchantServiceLike = Pick<MerchantService, 'getForUser' | 'updateForUser'>;

export function createMerchantController(service: MerchantServiceLike = new MerchantService()) {
  return {
    getMerchant: (async (req, res) => {
      sendSuccess(res, await service.getForUser(req.auth!.userId));
    }) satisfies RequestHandler,
    updateMerchant: (async (req, res) => {
      sendSuccess(res, await service.updateForUser(req.auth!.userId, merchantUpdateSchema.parse(req.body)));
    }) satisfies RequestHandler
  };
}
