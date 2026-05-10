import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtUserPayload {
  id: number;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const qa = req.query['access_token'];
  const queryToken = typeof qa === 'string' ? qa : undefined;
  const tokenRaw = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken || null;
  const token = tokenRaw?.trim() || null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  try {
    const payload = jwt.verify(token, secret) as JwtUserPayload;
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

/** То же, что authMiddleware (query `access_token` уже поддерживается). */
export function authOrQueryMiddleware(req: Request, res: Response, next: NextFunction) {
  return authMiddleware(req, res, next);
}
