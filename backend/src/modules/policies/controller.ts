import type { RequestHandler } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../utils/api-response.js';
import { PolicyService } from './service.js';
import { policyCheckSchema, policyRulesSchema } from './validation.js';

const service = new PolicyService();
const idSchema = z.string().uuid();

export const check: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.checkForUser(
    req.auth!.userId,
    idSchema.parse(req.params.id),
    policyCheckSchema.parse(req.body)
  ));
};

export const get: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.getForUser(req.auth!.userId));
};

export const update: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.updateForUser(req.auth!.userId, policyRulesSchema.parse(req.body)));
};
