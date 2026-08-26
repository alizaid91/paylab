import type { RequestHandler } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../utils/api-response.js';
import { OpportunityService } from './service.js';
import { opportunityListQuerySchema } from './validation.js';
import { StrategyService } from '../strategies/service.js';

const service = new OpportunityService();
const idSchema = z.string().uuid();
const strategyService = new StrategyService();

export const analyze: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.analyzeForUser(req.auth!.userId), 201);
};

export const list: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.listForUser(req.auth!.userId, opportunityListQuerySchema.parse(req.query)));
};

export const getById: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.getByIdForUser(req.auth!.userId, idSchema.parse(req.params.id)));
};

export const generateStrategy: RequestHandler = async (req, res) => {
  sendSuccess(res, await strategyService.generateForOpportunity(req.auth!.userId, idSchema.parse(req.params.id)), 201);
};
