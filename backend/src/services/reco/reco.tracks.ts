import { seededShuffle } from "../../utils/shuffle";
import { normalizeDuration } from "../track-media.service";
import type { RecoTrack } from "./reco.types";

export function asRecoTrack(row: {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  duration?: number | string | null;
}): RecoTrack {
  return {
    trackId: row.trackId,
    title: row.title,
    artist: row.artist,
    thumbnailUrl: row.thumbnailUrl ?? null,
    duration: normalizeDuration(row.duration),
  };
}

/** Drops duplicate `trackId`s, keeping the first occurrence, up to `limit`. */
export function takeUniqueTracks(
  rows: readonly RecoTrack[],
  limit: number,
): RecoTrack[] {
  const out: RecoTrack[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const id = (row.trackId ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

export function takeUniqueTracksShuffled(
  rows: readonly RecoTrack[],
  limit: number,
  seed: number,
): RecoTrack[] {
  return takeUniqueTracks(seededShuffle(rows, seed), limit);
}

/**
 * Caps how many tracks a single artist may contribute, so the feed is not
 * flooded by one popular act.
 */
export function capArtists(
  rows: readonly RecoTrack[],
  perArtistLimit: number,
  totalLimit: number,
): RecoTrack[] {
  const out: RecoTrack[] = [];
  const counts = new Map<string, number>();
  for (const row of rows) {
    const artist = row.artist.trim();
    if (!artist) continue;
    const n = counts.get(artist) ?? 0;
    if (n >= perArtistLimit) continue;
    counts.set(artist, n + 1);
    out.push(row);
    if (out.length >= totalLimit) break;
  }
  return out;
}

/** Artists ordered by how many tracks they appear on. */
export function pickTopArtists(
  tracks: ReadonlyArray<{ artist: string }>,
  limit: number,
): string[] {
  const counts = new Map<string, number>();
  for (const row of tracks) {
    const artist = row.artist.trim();
    if (!artist) continue;
    counts.set(artist, (counts.get(artist) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([artist]) => artist);
}

/**
 * Keywords that mark an endless radio/video upload rather than a real song.
 *
 * The patterns are anchored on stream wording on purpose: a legitimate release
 * such as "Extended Mix" or an actual lofi track must survive the filter, and
 * only endless "24/7 radio" style uploads are meant to be rejected.
 */
const STREAM_TITLE_MARKERS = [
  "top hits",
  "top 100",
  "top 50",
  "top 40",
  "top songs",
  "vlog",
  " dj mix",
  "mega mix",
  "mix 202",
  "non stop",
  "non-stop",
  "24/7",
  "24-7",
  "24 hour",
  "24hours",
  "all day",
  "live stream",
  "livestream",
  "hour radio",
  "radio stream",
  "lofi mix",
  "lo-fi mix",
  "chillhop radio",
  "playlist radio",
  "compilation",
  "greatest hits",
  "stream",
];

/** Anything longer than an hour is a stream upload, not a track. */
const STREAM_MAX_DURATION_SEC = 3600;

/**
 * Detects livestreams, DJ sets and multi-hour radio uploads that YouTube
 * returns as regular songs. Such a track never ends on its own, so it must
 * never reach the player.
 */
export function isLikelyCompilation(track: RecoTrack): boolean {
  const duration = normalizeDuration(track.duration);
  if (duration != null && duration > STREAM_MAX_DURATION_SEC) return true;

  const title = (track.title ?? "").toLowerCase();
  return STREAM_TITLE_MARKERS.some((marker) => title.includes(marker));
}
