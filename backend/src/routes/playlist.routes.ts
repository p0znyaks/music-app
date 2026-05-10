import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  addPlaylistTrack,
  createPlaylist,
  deletePlaylist,
  listPlaylistTracks,
  listPlaylists,
  removePlaylistTrack,
} from '../controllers/playlist.controller';

export const playlistRouter = Router();

playlistRouter.use(authMiddleware);

playlistRouter.post('/', createPlaylist);
playlistRouter.get('/', listPlaylists);
playlistRouter.delete('/:id/tracks/:trackId', removePlaylistTrack);
playlistRouter.get('/:id/tracks', listPlaylistTracks);
playlistRouter.post('/:id/tracks', addPlaylistTrack);
playlistRouter.delete('/:id', deletePlaylist);
