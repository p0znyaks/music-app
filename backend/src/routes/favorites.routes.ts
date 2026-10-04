import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { addFavorite, listFavorites, removeFavorite } from '../controllers/favorites.controller';

export const favoritesRouter = Router();

favoritesRouter.use(authMiddleware);
favoritesRouter.post('/', addFavorite);
favoritesRouter.get('/', listFavorites);
favoritesRouter.delete('/:trackId', removeFavorite);
