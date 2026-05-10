import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

const authService = new AuthService();

export async function register(req: Request, res: Response) {
  try {
    const { username, email, password } = req.body ?? {};
    if (
      typeof username !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({ message: 'username, email and password are required' });
    }

    const result = await authService.register(username, email, password);
    return res.status(201).json(result);
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'EMAIL_TAKEN') {
      return res.status(409).json({ code: e.code, message: e.message ?? 'Email already registered' });
    }
    if (e.code === 'USERNAME_TAKEN') {
      return res.status(409).json({ code: e.code, message: e.message ?? 'Username already taken' });
    }
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const result = await authService.login(email, password);
    return res.json(result);
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: e.message ?? 'Invalid credentials' });
    }
    if (e.code === 'BLOCKED') {
      return res.status(403).json({ message: e.message ?? 'Account is blocked' });
    }
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
