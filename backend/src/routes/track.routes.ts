import { Router } from 'express';
import { getMetadata, getProxyStream, getStreamUrl } from '../controllers/track.controller';
import { authMiddleware, authOrQueryMiddleware } from '../middleware/auth.middleware';

export const trackRouter = Router();

trackRouter.get('/:trackId/stream', authMiddleware, getStreamUrl);
trackRouter.get('/:trackId/proxy-stream', authOrQueryMiddleware, getProxyStream);
trackRouter.get('/:trackId/metadata', authMiddleware, getMetadata);
