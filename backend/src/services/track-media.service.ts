import { envInt } from '../env';
import type { Repository } from 'typeorm';
import { redisGetSWR } from './cache-swr';
import { ytdlpService } from './ytdlp.service';
import { ytmusicService } from './ytmusic.service';

/**
 * Canonical place for "how long is this track" and "what does it look like".
 *
 * Durations reach the app from three directions — the client body, the YouTube
 * Music API and yt-dlp — as seconds, milliseconds or clock strings, and can be
 * missing entirely. Every write path normalizes through here, so a row stored
 * today has the same shape as one stored after the InnerTube switch.
 */

/** Anything longer than a day is milliseconds, not seconds. */
const MS_HEURISTIC_THRESHOLD = 86400;

/** Metadata never changes for a given video id, so it caches for a long time. */
const TRACK_META_TTL_SEC = envInt('REDIS_TTL_TRACK_META_SEC', 604800);

export type TrackMedia = {
  thumbnailUrl: string | null;
  duration: number | null;
};

export type PartialTrackMedia = {
  trackId?: string | null;
  thumbnailUrl?: string | null;
  duration?: number | string | null;
};

export function isYoutubeVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id.trim());
}

/** Every video id has a deterministic thumbnail, so the UI needs no placeholder. */
export function youtubeThumbnailFallbackUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId.trim()}/hqdefault.jpg`;
}

/**
 * Accepts the shapes a track length can arrive in: seconds, a millisecond
 * count, a clock string (`m:ss` / `h:mm:ss`) or nothing. Returns seconds, or
 * `null` when the length is genuinely unknown.
 */
export function normalizeDuration(duration: unknown): number | null {
  if (duration == null) return null;
  if (typeof duration !== 'number' && typeof duration !== 'string') return null;

  if (typeof duration === 'number') {
    if (!Number.isFinite(duration) || duration <= 0) return null;
    return duration > MS_HEURISTIC_THRESHOLD ? Math.round(duration / 1000) : Math.round(duration);
  }

  const trimmed = duration.trim();
  if (!trimmed) return null;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n > MS_HEURISTIC_THRESHOLD ? Math.round(n / 1000) : Math.round(n);
  }

  const parts = trimmed.split(':').map((p) => Number(p.trim()));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  if (parts.length === 2) return Math.round(parts[0]! * 60 + parts[1]!);
  if (parts.length === 3) return Math.round(parts[0]! * 3600 + parts[1]! * 60 + parts[2]!);
  return null;
}

/** True when the length is unknown, which is not the same as "zero seconds". */
function hasUnknownDuration(track: { duration?: number | string | null }): boolean {
  return normalizeDuration(track.duration) == null;
}

/** True when no artwork has been supplied yet. */
function hasUnknownThumbnail(track: { thumbnailUrl?: string | null }): boolean {
  return typeof track.thumbnailUrl !== 'string' || track.thumbnailUrl.trim().length === 0;
}

/** Fetches artwork and length for one track, uncached. */
async function fetchTrackMedia(trackId: string): Promise<TrackMedia> {
  const id = trackId.trim();

  try {
    const [song] = await ytmusicService.getSongsBatch([id]);
    if (song) {
      const thumbnailUrl = (song.thumbnailUrl ?? '').trim();
      const duration = normalizeDuration(song.duration);
      if (thumbnailUrl || duration != null) {
        return { thumbnailUrl: thumbnailUrl || null, duration };
      }
    }
  } catch {
    // Fall through to yt-dlp.
  }

  try {
    const meta = await ytdlpService.getMetadata(id);
    return {
      thumbnailUrl: (meta.thumbnailUrl ?? '').trim() || null,
      duration: normalizeDuration(meta.duration),
    };
  } catch {
    // Upstream is unavailable: fall back to the deterministic thumbnail URL.
    return {
      thumbnailUrl: isYoutubeVideoId(id) ? youtubeThumbnailFallbackUrl(id) : null,
      duration: null,
    };
  }
}

/** Track metadata never changes, so there is nothing worth revalidating: no
 *  background refresh, only de-duplication of concurrent misses. */
const trackMediaInflight = new Map<string, Promise<TrackMedia>>();

/** Artwork and length for one track. Cached, so repeats cost one Redis read. */
export function getTrackMedia(trackId: string): Promise<TrackMedia> {
  const id = trackId.trim();
  if (!id) return Promise.resolve({ thumbnailUrl: null, duration: null });

  return redisGetSWR<TrackMedia>(
    `track:media:v2:${id}`,
    TRACK_META_TTL_SEC,
    Number.MAX_SAFE_INTEGER,
    () => fetchTrackMedia(id),
    trackMediaInflight,
    new Map<string, Promise<void>>(),
  );
}

/**
 * Completes a track payload before it is written to the database, so a row
 * created from a clip, a pasted URL or any source that knows no length still
 * gets one. Values the client already supplied win: it heard the track, and the
 * API agrees.
 */
export async function completeTrackMedia(track: PartialTrackMedia): Promise<TrackMedia> {
  const id = (track.trackId ?? '').trim();
  const duration = normalizeDuration(track.duration);
  const thumbnailUrl = (track.thumbnailUrl ?? '').trim();

  if (duration != null && thumbnailUrl) {
    return { duration, thumbnailUrl };
  }

  // Clips and other synthetic ids have no upstream metadata to look up.
  if (!isYoutubeVideoId(id)) {
    return { duration, thumbnailUrl: thumbnailUrl || null };
  }

  const fetched = await getTrackMedia(id);
  return {
    duration: duration ?? fetched.duration,
    thumbnailUrl: thumbnailUrl || fetched.thumbnailUrl,
  };
}

/**
 * Best-effort backfill for rows stored before durations were filled in on
 * write. `maxLookup` bounds the number of upstream calls per request.
 */
export async function fillMissingTrackMedia<T extends PartialTrackMedia>(
  rows: T[],
  maxLookup = 10,
): Promise<T[]> {
  const needsLookup = (row: T): boolean => {
    const id = (row.trackId ?? '').trim();
    if (!isYoutubeVideoId(id)) return false;
    return hasUnknownThumbnail(row) || hasUnknownDuration(row);
  };

  const missingIds = [...new Set(rows.filter(needsLookup).map((row) => row.trackId!.trim()))].slice(
    0,
    maxLookup,
  );
  if (missingIds.length === 0) return rows;

  const byId = new Map<string, TrackMedia>();
  await Promise.all(
    missingIds.map(async (id) => {
      try {
        byId.set(id, await getTrackMedia(id));
      } catch {
        // Leave this id unresolved; the UI hides what it does not know.
      }
    }),
  );

  return rows.map((row) => {
    const id = (row.trackId ?? '').trim();
    const fetched = byId.get(id);
    if (!fetched) return row;

    if (hasUnknownThumbnail(row) && fetched.thumbnailUrl) {
      row.thumbnailUrl = fetched.thumbnailUrl;
    }
    if (hasUnknownDuration(row) && fetched.duration != null) {
      row.duration = fetched.duration;
    }
    return row;
  });
}

/** Fills in durations on stored rows that still lack one. Used by the repair script. */
export async function updateDurationsWhereMissing(
  repo: Repository<{ duration: number | null }>,
  trackId: string,
  duration: number,
): Promise<number> {
  const result = await repo
    .createQueryBuilder()
    .update()
    .set({ duration })
    .where('track_id = :trackId', { trackId })
    .andWhere('(duration IS NULL OR duration <= 0)')
    .execute();
  return result.affected ?? 0;
}
