import type { RequestHandler } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../utils/api-response.js';
import { RecoveryCampaignService } from './service.js';

const service = new RecoveryCampaignService();
const idSchema = z.string().uuid();
const createInputSchema = z.object({ strategyId: z.string().uuid() });

export const create: RequestHandler = async (req, res) => {
  const { strategyId } = createInputSchema.parse(req.body);
  sendSuccess(res, await service.createForUser(req.auth!.userId, strategyId), 201);
};

export const list: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.listForUser(req.auth!.userId));
};

export const getById: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.getByIdForUser(req.auth!.userId, idSchema.parse(req.params.id)));
};

export const start: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.startForUser(req.auth!.userId, idSchema.parse(req.params.id)));
};

export const stop: RequestHandler = async (req, res) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'MERCHANT_CANCELLATION';
  sendSuccess(res, await service.stopForUser(req.auth!.userId, idSchema.parse(req.params.id), reason));
};

export const resume: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.resumeForUser(req.auth!.userId, idSchema.parse(req.params.id)));
};
