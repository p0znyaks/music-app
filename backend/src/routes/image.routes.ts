import { Router } from 'express';
import { proxyImage } from '../controllers/image.controller';

export const imageRouter = Router();

imageRouter.get('/images/proxy', proxyImage);
