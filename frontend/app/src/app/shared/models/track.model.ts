export interface AppTrack {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  duration?: number | null;
  startTime?: number | null;
  endTime?: number | null;
  addedAt?: string | null;
}
