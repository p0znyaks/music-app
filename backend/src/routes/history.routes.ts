import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { addHistory, listHistory } from '../controllers/history.controller';

export const historyRouter = Router();

historyRouter.use(authMiddleware);
historyRouter.post('/', addHistory);
historyRouter.get('/', listHistory);
