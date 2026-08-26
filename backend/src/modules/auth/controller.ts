import type { RequestHandler } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import { registerSchema, loginSchema } from './validation.js';
import { AuthService } from './service.js';

export type AuthServiceLike = Pick<AuthService, 'register' | 'login' | 'getCurrentUser'>;

export function createAuthController(service: AuthServiceLike = new AuthService()) {
  return {
    register: (async (req, res) => {
      sendSuccess(res, await service.register(registerSchema.parse(req.body)), 201);
    }) satisfies RequestHandler,

    login: (async (req, res) => {
      sendSuccess(res, await service.login(loginSchema.parse(req.body)));
    }) satisfies RequestHandler,

    me: (async (req, res) => {
      sendSuccess(res, await service.getCurrentUser(req.auth!.userId));
    }) satisfies RequestHandler
  };
}
