export interface SearchResult {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number | string;
  channelId?: string;
}

export interface SearchAlbumDto {
  albumId: string;
  title: string;
  artist: string;
  year: number | null;
  thumbnailUrl: string;
}

export interface SearchArtistDto {
  id: string;
  name: string;
  thumbnailUrl: string;
}

export interface SearchBundle {
  tracks: SearchResult[];
  albums: SearchAlbumDto[];
  artists: SearchArtistDto[];
}

export interface TrackMetadata {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number;
}
