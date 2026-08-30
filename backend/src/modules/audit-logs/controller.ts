import type { RequestHandler } from 'express';
import { AuditLogService } from './service.js';
import { sendSuccess } from '../../utils/api-response.js';

const service = new AuditLogService();

export const list: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.listForUser(
    req.auth!.userId,
    typeof req.query.strategyId === 'string' ? req.query.strategyId : undefined,
    typeof req.query.executionId === 'string' ? req.query.executionId : undefined,
    typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined
  ));
};
