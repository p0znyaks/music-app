import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { createClip, getClipByShortCode, proxyClipByShortCode } from '../controllers/clips.controller';

export const clipsRouter = Router();

clipsRouter.get('/:shortCode', getClipByShortCode);
clipsRouter.get('/:shortCode/proxy-stream', proxyClipByShortCode);
clipsRouter.post('/', authMiddleware, createClip);
