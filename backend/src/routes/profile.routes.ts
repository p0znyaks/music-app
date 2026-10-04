import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getProfile } from '../controllers/profile.controller';

export const profileRouter = Router();

profileRouter.use(authMiddleware);
profileRouter.get('/', getProfile);
