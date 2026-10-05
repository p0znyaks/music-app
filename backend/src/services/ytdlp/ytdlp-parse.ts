import { normalizeDuration } from '../track-media.service';
import type { TrackMetadata } from './ytdlp.types';

/** A yt-dlp `--dump-json` entry, before it becomes one of our DTOs. */
export type YtdlpEntry = Record<string, unknown>;

/** Best available artwork URL from a flat or full yt-dlp entry. */
export function pickThumbnail(entry: YtdlpEntry): string {
  if (typeof entry.thumbnail === 'string' && entry.thumbnail) {
    return entry.thumbnail;
  }
  const thumbs = entry.thumbnails;
  if (Array.isArray(thumbs) && thumbs.length > 0) {
    const first = thumbs[0] as Record<string, unknown>;
    if (typeof first.url === 'string') {
      return first.url;
    }
  }
  return '';
}

/** Flat entries carry `uploader`/`channel` where full entries carry `artist`. */
export function pickArtist(entry: YtdlpEntry): string {
  for (const key of ['artist', 'uploader', 'channel'] as const) {
    const value = entry[key];
    if (typeof value === 'string' && value) {
      return value;
    }
  }
  return '';
}

/** Parses the newline-delimited JSON that `--dump-json` writes to stdout. */
export function parseJsonLines(stdout: string): YtdlpEntry[] {
  const out: YtdlpEntry[] = [];
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      out.push(JSON.parse(trimmed) as YtdlpEntry);
    } catch {
      continue;
    }
  }
  return out;
}

export function isYoutubeVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

export function mapFullEntry(entry: YtdlpEntry): TrackMetadata {
  return {
    trackId: typeof entry.id === 'string' ? entry.id : '',
    title: typeof entry.title === 'string' ? entry.title : '',
    artist: pickArtist(entry),
    thumbnailUrl: pickThumbnail(entry),
    duration: normalizeDuration(entry.duration) ?? 0,
  };
}

/**
 * Canonical form of a search query for cache keys.
 *
 * YouTube treats "Rihanna", "rihanna" and "  Rihanna   " as the same search,
 * so without this every casing and whitespace variation became a separate
 * upstream request on top of a separate cache entry.
 */
export function normalizeQueryForCache(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}
