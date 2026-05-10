import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getMix, getMixPreferences, putMixPreferences } from '../controllers/mix.controller';

export const mixRouter = Router();

mixRouter.use(authMiddleware);
mixRouter.get('/', getMix);
mixRouter.get('/preferences', getMixPreferences);
mixRouter.put('/preferences', putMixPreferences);
mixRouter.post('/preferences', putMixPreferences);
