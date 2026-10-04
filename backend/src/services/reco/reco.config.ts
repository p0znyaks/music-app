import { envInt } from "../../env";
import { seededShuffle } from "../../utils/shuffle";

/** One carousel page holds six cards. */
export const PAGE_SIZE = 6;
/** How many pages the user may page forward from the first one. */
export const MAX_FORWARD_PAGES = 2;
/** Total cards in one block: the visible page plus everything reachable by paging. */
export const PAGE_TOTAL = PAGE_SIZE * (MAX_FORWARD_PAGES + 1);

/** How many listening-history seeds feed the radio lookup. */
export const MAX_RECO_SEEDS = 3;
/** How many distinct artists seed the "similar to" and album blocks. */
export const MAX_TOP_ARTISTS = 5;
/** How many genre blocks (and therefore how many mixes) the feed contains. */
export const MAX_GENRE_BLOCKS = 3;
/** A mix card needs at least this many tracks to be worth showing. */
export const MIN_MIX_TRACKS = 3;
/** Below this the radio feed is considered too thin and gets topped up. */
export const MIN_RADIO_TRACKS = 8;

/**
 * The home key carries its UTC hour, so a new bucket starts every hour. A TTL
 * comfortably longer than that keeps the current hour served from cache while
 * letting yesterday's buckets expire instead of lingering as dead entries.
 */
export const TTL_RECO_HOME_SEC = envInt("REDIS_TTL_RECO_HOME_SEC", 2 * 60 * 60);
export const TTL_RECO_MIX_SEC = envInt(
  "REDIS_TTL_RECO_MIX_SEC",
  TTL_RECO_HOME_SEC,
);
export const TTL_RECO_SIMILAR_SEC = envInt(
  "REDIS_TTL_RECO_SIMILAR_SEC",
  TTL_RECO_HOME_SEC,
);

/** Cache key for the assembled home payload. Bucketed by UTC hour so the feed
 *  rotates on its own without a background job. */
export function recoHomeCacheKey(userId: number, hourBucket: string): string {
  return `reco:home:v4:${userId}:h:${hourBucket}`;
}

export function mixCacheKey(params: {
  userId: number;
  hourBucket: string;
  n: number;
}): string {
  return `reco:mix:v2:${params.userId}:h:${params.hourBucket}:n:${params.n}`;
}

export function similarCacheKey(seedArtist: string): string {
  return `reco:similarTo:v2:${seedArtist}`;
}

/** `YYYYMMDDHH` in UTC — the rotation window for cached feeds. */
export function hourBucketUtc(ts = new Date()): string {
  const y = ts.getUTCFullYear();
  const m = String(ts.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ts.getUTCDate()).padStart(2, "0");
  const h = String(ts.getUTCHours()).padStart(2, "0");
  return `${y}${m}${d}${h}`;
}

/** Per-user fallback genres so a user without history still gets a varied feed. */
export function getPersonalizedFallbackGenres(
  userId: number,
  limit = 8,
): string[] {
  const shuffled = seededShuffle(FALLBACK_GENRES, userId);
  return shuffled.slice(0, limit);
}

const FALLBACK_GENRES = [
  "pop",
  "rock",
  "electronic",
  "hip hop",
  "indie",
  "alternative",
  "r&b",
  "lofi",
  "jazz",
  "house",
];
