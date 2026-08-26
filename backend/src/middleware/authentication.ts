import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

export interface AuthenticatedUser {
  userId: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
    }
  }
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required'));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload === 'string' || !('sub' in payload) || typeof payload.sub !== 'string') {
      return next(new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token'));
    }
    req.auth = { userId: payload.sub };
    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError(401, 'TOKEN_EXPIRED', 'Authentication token has expired'));
    }
    return next(new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token'));
  }
};

export function createAccessToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, { subject: userId, expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}
