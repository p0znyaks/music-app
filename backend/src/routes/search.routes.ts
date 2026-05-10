import { Router } from 'express';
import {
  getAlbumByBrowseId,
  getArtistByBrowseId,
  search,
  searchAlbums,
  searchArtists,
} from '../controllers/search.controller';

export const searchRouter = Router();

searchRouter.get('/search/albums', searchAlbums);
searchRouter.get('/search/artists', searchArtists);
searchRouter.get('/albums/:browseId', getAlbumByBrowseId);
searchRouter.get('/artists/:browseId', getArtistByBrowseId);
searchRouter.get('/search', search);
