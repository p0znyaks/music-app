import type { AppTrack } from '../../shared/models/track.model';

/** Ответ GET /api/search — блок albums/artists с yt-dlp (для смешанного поиска не используем в UI). */
export interface SearchBundle {
  tracks: AppTrack[];
  albums: unknown[];
  artists: unknown[];
}

/** NDJSON-кадры GET /api/search (application/x-ndjson). */
export type SearchStreamChunk =
  | { kind: 'meta'; query: string }
  | { kind: 'tracks'; partial: boolean; items: AppTrack[] }
  | { kind: 'albums'; items: unknown[] }
  | { kind: 'artists'; items: unknown[] }
  | { kind: 'done' };

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
