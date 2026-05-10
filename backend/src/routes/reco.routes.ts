import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getRecoHome, getRecoMix } from '../controllers/reco.controller';

export const recoRouter = Router();

recoRouter.use(authMiddleware);
recoRouter.get('/reco/home', getRecoHome);
recoRouter.get('/reco/mixes/:id', getRecoMix);
