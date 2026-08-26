import type { RequestHandler } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../utils/api-response.js';
import { StrategyService } from './service.js';
import { SimulationService } from '../simulations/service.js';
import { simulationInputSchema } from './validation.js';
import { AdvisoryService } from './advisory-service.js';
import { ExecutionService } from '../executions/service.js';

const strategyService = new StrategyService();
const simulationService = new SimulationService();
const advisoryService = new AdvisoryService();
const executionService = new ExecutionService();
const idSchema = z.string().uuid();

export const generateStrategy: RequestHandler = async (req, res) => {
  sendSuccess(res, await strategyService.generateForOpportunity(req.auth!.userId, idSchema.parse(req.params.id)), 201);
};

export const getById: RequestHandler = async (req, res) => {
  sendSuccess(res, await strategyService.getByIdForUser(req.auth!.userId, idSchema.parse(req.params.id)));
};

export const simulate: RequestHandler = async (req, res) => {
  sendSuccess(res, await simulationService.simulateForUser(
    req.auth!.userId,
    idSchema.parse(req.params.id),
    simulationInputSchema.parse(req.body)
  ), 201);
};

export const listSimulations: RequestHandler = async (req, res) => {
  sendSuccess(res, await simulationService.listForUser(req.auth!.userId, idSchema.parse(req.params.id)));
};

export const advisoryReview: RequestHandler = async (req, res) => {
  sendSuccess(res, await advisoryService.reviewForUser(req.auth!.userId, idSchema.parse(req.params.id)), 201);
};

export const approve: RequestHandler = async (req, res) => {
  sendSuccess(res, await executionService.approveForUser(req.auth!.userId, idSchema.parse(req.params.id)));
};

export const execute: RequestHandler = async (req, res) => {
  sendSuccess(res, await executionService.executeForUser(req.auth!.userId, idSchema.parse(req.params.id)), 201);
};
