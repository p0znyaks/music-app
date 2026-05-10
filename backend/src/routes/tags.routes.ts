import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  addTag,
  listDistinctTags,
  listMoods,
  listTags,
  listTrackTags,
  moodPlaylist,
  removeTrackTag,
  tagsPlaylist,
} from '../controllers/tags.controller';

export const tagsRouter = Router();

tagsRouter.use(authMiddleware);

tagsRouter.post('/', addTag);
tagsRouter.get('/distinct', listDistinctTags);
tagsRouter.get('/track/:trackId', listTrackTags);
tagsRouter.delete('/track/:trackId/:tag', removeTrackTag);
tagsRouter.get('/playlist', tagsPlaylist);
tagsRouter.get('/moods', listMoods);
tagsRouter.get('/mood/:tag', moodPlaylist);
tagsRouter.get('/', listTags);
