/**
 * Artwork for a playlist row: a 2×2 collage when there are four distinct covers,
 * otherwise the single cover we have (possibly none).
 */
export type PlaylistPreview =
  { kind: 'mosaic'; urls: string[] } | { kind: 'single'; url: string | null };

export interface PlaylistRow {
  id: number;
  name: string;
  trackCount: number;
  preview: PlaylistPreview;
}

/** Minimal shape needed to pick a preview; callers pass richer rows. */
interface PreviewSource {
  thumbnailUrl: string | null;
}

const MOSAIC_SIZE = 4;

/**
 * Picks the artwork for a playlist row.
 *
 * A collage needs four genuinely different covers, otherwise the grid looks
 * broken, so anything less falls back to a single image.
 */
export function buildPlaylistPreview(tracks: PreviewSource[]): PlaylistPreview {
  const single: PlaylistPreview = { kind: 'single', url: tracks[0]?.thumbnailUrl ?? null };
  if (tracks.length < MOSAIC_SIZE) {
    return single;
  }

  const urls = tracks
    .slice(0, MOSAIC_SIZE)
    .map((t) => t.thumbnailUrl)
    .filter((u): u is string => !!u);

  if (urls.length < MOSAIC_SIZE || new Set(urls).size < MOSAIC_SIZE) {
    return single;
  }

  return { kind: 'mosaic', urls };
}
