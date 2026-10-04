/** Shapes returned by `/api/reco/*`. Kept in one place so the builders, the
 *  cache layer and the HTTP handlers all agree on the contract. */

export type RecoTrack = {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  duration: number | string | null;
};

export type RecoAlbum = {
  browseId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  year: string;
};

export type RecoArtist = {
  browseId: string;
  name: string;
  thumbnailUrl: string;
  subscribers: string;
};

export type MixTrackRow = {
  id: number;
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  duration: number | string | null;
};

export type MixCard = {
  id: string;
  title: string;
  subtitle: string;
  thumbnailUrl: string | null;
  artists: string[];
  previewThumbs?: string[];
};

export type SimilarBlock = { seedArtist: string; items: RecoArtist[] };

export type GenreBlock = { genre: string; tracks: RecoTrack[] };

export type HomeRecoResponse = {
  generatedAt: string;
  carousel: { pageSize: number; maxForwardPages: number };
  recommendedTracks: RecoTrack[];
  albumsForYou: RecoAlbum[];
  mixesForYou: MixCard[];
  similarTo: SimilarBlock[];
  byGenre: GenreBlock[];
};
