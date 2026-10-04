import type { AppTrack } from '../../shared/models/track.model';

/**
 * Ответ GET /api/search — треки. Альбомы и исполнители приходят отдельными
 * эндпоинтами (search/albums, search/artists), поэтому в UI не используются.
 */
export interface SearchBundle {
  tracks: AppTrack[];
  albums: unknown[];
  artists: unknown[];
}

/** Карточка альбома: GET /api/search/albums */
export interface YtmAlbumCard {
  browseId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  year: string;
}

/** Карточка исполнителя: GET /api/search/artists */
export interface YtmArtistCard {
  browseId: string;
  name: string;
  thumbnailUrl: string;
  subscribers: string;
}

/** GET /api/albums/:browseId */
export interface AlbumDetailDto {
  title: string;
  artist: string;
  year: string;
  thumbnailUrl: string;
  tracks: AlbumTrackDto[];
}

export interface AlbumTrackDto {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number;
}

/** GET /api/artists/:browseId */
export interface ArtistDetailDto {
  name: string;
  thumbnailUrl: string;
  subscribers: string;
  albums: ArtistAlbumRefDto[];
}

export interface ArtistAlbumRefDto {
  browseId: string;
  title: string;
  year: string;
  thumbnailUrl: string;
}
