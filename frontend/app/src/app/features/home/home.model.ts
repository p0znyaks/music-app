import type { AppTrack } from '../../shared/models/track.model';

export interface HomeRecoArtistCard {
  browseId: string;
  name: string;
  thumbnailUrl: string;
  subscribers: string;
}

export interface HomeRecoAlbumCard {
  browseId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  year: string;
}

export interface HomeRecoMixCard {
  id: string;
  title: string;
  subtitle: string;
  thumbnailUrl: string | null;
  artists: string[];
  previewThumbs?: string[];
}

export interface HomeRecoGenreBlock {
  genre: string;
  tracks: AppTrack[];
}

export interface HomeRecoResponse {
  generatedAt: string;
  carousel: {
    pageSize: number;
    maxForwardPages: number;
  };
  recommendedTracks: AppTrack[];
  albumsForYou: HomeRecoAlbumCard[];
  mixesForYou: HomeRecoMixCard[];
  similarTo: Array<{
    seedArtist: string;
    items: HomeRecoArtistCard[];
  }>;
  byGenre: HomeRecoGenreBlock[];
}

/** NDJSON-кадры GET /api/reco/home. */
export type HomeRecoStreamChunk =
  | { kind: 'meta'; generatedAt: string; carousel: HomeRecoResponse['carousel'] }
  | { kind: 'recommendedTracks'; items: AppTrack[] }
  | { kind: 'mixesForYou'; items: HomeRecoMixCard[] }
  | { kind: 'similarTo'; items: HomeRecoResponse['similarTo'] }
  | { kind: 'byGenre'; items: HomeRecoGenreBlock[] }
  | { kind: 'albumsForYou'; items: HomeRecoAlbumCard[] }
  | { kind: 'done' };
