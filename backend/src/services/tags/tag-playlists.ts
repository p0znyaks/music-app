import { envInt } from '../../env';
import { shuffle } from '../../utils/shuffle';
import { redisGetSWR } from '../cache-swr';
import { getRedis } from '../redis';
import { clipShortCode, loadClipTimes } from './clip-times';
import { MOOD_PLAYLIST_LIMIT, TAGS_PLAYLIST_LIMIT, normTag } from './tag-normalize';
import { findTracksByTags, type TagRow } from './tag-queries';

/**
 * Building a playlist out of tags.
 *
 * One implementation serves both shapes the app offers: a single mood
 * ("focus") and a combination of up to four ("focus + energy"). The only real
 * differences are the tag count and the display name, so both go through
 * `buildTagPlaylist` rather than duplicating the query, shuffle and clip
 * resolution logic.
 */

export type TagPlaylistTrack = {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  duration: number | null;
  addedAt?: string;
  startTime?: number;
  endTime?: number;
};

export type TagPlaylist = {
  playlistName: string;
  tracks: TagPlaylistTrack[];
};

/** Built playlists are cheap to rebuild but cost two queries, so they cache. */
const TTL_TAG_PLAYLIST_SEC = envInt('REDIS_TTL_TAG_PLAYLIST_SEC', 1200);

const playlistInflight = new Map<string, Promise<TagPlaylist>>();
const playlistInflightRefresh = new Map<string, Promise<void>>();

/** Display name: `Playlist: focus` or `Playlist: focus + energy`. */
function buildPlaylistName(displayTags: readonly string[]): string {
  return `Playlist: ${displayTags.join(' + ')}`;
}

/**
 * Resolves clip boundaries and drops tracks that collapsed into each other,
 * then shuffles so opening the playlist twice does not feel frozen.
 */
async function toPlaylistTracks(
  rows: readonly TagRow[],
  limit: number,
): Promise<TagPlaylistTrack[]> {
  const seen = new Set<string>();
  const unique: TagRow[] = [];
  for (const row of rows) {
    if (seen.has(row.trackId)) continue;
    seen.add(row.trackId);
    unique.push(row);
  }

  const selected = shuffle(unique).slice(0, limit);
  const clipTimes = await loadClipTimes(selected.map((row) => row.trackId));

  return selected.map((row) => {
    const track: TagPlaylistTrack = {
      trackId: row.trackId,
      title: row.title,
      artist: row.artist,
      thumbnailUrl: row.thumbnailUrl,
      duration: row.duration,
    };
    if (row.addedAt) {
      track.addedAt = row.addedAt.toISOString();
    }

    const shortCode = clipShortCode(row.trackId);
    const clip = shortCode ? clipTimes.get(shortCode) : undefined;
    if (clip) {
      track.startTime = clip.startTime;
      track.endTime = clip.endTime;
    }

    return track;
  });
}

async function loadTagPlaylist(
  userId: number,
  tagNorms: readonly string[],
  displayTags: readonly string[],
  limit: number,
): Promise<TagPlaylist> {
  const rows = await findTracksByTags(userId, tagNorms);
  return {
    playlistName: buildPlaylistName(displayTags),
    tracks: await toPlaylistTracks(rows, limit),
  };
}

/** Playlist for one mood tag. */
export function buildMoodPlaylist(
  userId: number,
  tag: { display: string; norm: string },
): Promise<TagPlaylist> {
  return buildTagPlaylist(userId, [tag.norm], [tag.display], MOOD_PLAYLIST_LIMIT);
}

/** Playlist for up to four tags; a track must carry all of them. */
export function buildTagsPlaylist(
  userId: number,
  tags: ReadonlyArray<{ display: string; norm: string }>,
): Promise<TagPlaylist> {
  return buildTagPlaylist(
    userId,
    tags.map((tag) => tag.norm),
    tags.map((tag) => tag.display),
    TAGS_PLAYLIST_LIMIT,
  );
}

async function buildTagPlaylist(
  userId: number,
  tagNorms: readonly string[],
  displayTags: readonly string[],
  limit: number,
): Promise<TagPlaylist> {
  if (tagNorms.length === 0) {
    return { playlistName: buildPlaylistName(displayTags), tracks: [] };
  }

  // The key follows the tag set, so changing one mood yields a different entry.
  const key = `tagplaylist:v1:${userId}:${[...tagNorms].sort().map(normTag).join('+')}`;
  return redisGetSWR<TagPlaylist>(
    key,
    TTL_TAG_PLAYLIST_SEC,
    undefined,
    () => loadTagPlaylist(userId, tagNorms, displayTags, limit),
    playlistInflight,
    playlistInflightRefresh,
  );
}

/**
 * Drops cached playlists for a user. Called when their tags change, so the next
 * open reflects the edit instead of waiting for the TTL.
 */
export async function purgeTagPlaylists(userId: number): Promise<void> {
  const redis = getRedis();
  const keys = await redis.keys(`tagplaylist:v1:${userId}:*`).catch(() => [] as string[]);
  if (keys.length > 0) {
    await redis.del(...keys).catch(() => undefined);
  }
}
