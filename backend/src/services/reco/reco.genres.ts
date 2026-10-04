import { getPersonalizedFallbackGenres } from "./reco.config";
import { normalizeDuration } from "../track-media.service";
import type { RecoAlbum, RecoTrack } from "./reco.types";

/** More specific genres first — used in classification loops (first match wins). */
const GENRE_KEYWORDS: Record<string, string[]> = {
  "death metal": ["death metal", "deathcore"],
  "black metal": ["black metal"],
  metalcore: ["metalcore"],
  metal: ["metal", "thrash", "doom", "groove metal"],
  "hard rock": ["hard rock"],
  punk: ["punk", "hardcore punk"],
  rock: ["rock", "classic rock", "post rock"],
  alternative: ["alternative", "alt"],
  indie: ["indie", "dream pop", "shoegaze"],
  pop: ["pop", "synthpop"],
  "hip hop": ["hip hop", "hip-hop", "boom bap"],
  rap: ["rap", "trap", "drill"],
  electronic: ["electronic", "edm", "electro"],
  house: ["house", "tech house", "deep house"],
  ambient: ["ambient", "chill"],
  lofi: ["lofi", "lo-fi"],
  jazz: ["jazz", "fusion"],
  blues: ["blues"],
};

/** Broad genre each narrow genre rolls up into, used to avoid rejecting a track
 *  that merely belongs to a neighbouring genre. */
const GENRE_PARENT: Record<string, string> = {
  "death metal": "metal",
  "black metal": "metal",
  metalcore: "metal",
  "hard rock": "rock",
  punk: "rock",
  house: "electronic",
  ambient: "electronic",
  rap: "hip hop",
};

function normalizeText(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      // Strip combining diacritical marks so "Beyoncé" matches "beyonce".
      .replace(/[\u0300-\u036f]/g, "")
  );
}

/**
 * Returns false if the track's artist/title contains keywords of a genre that
 * is unrelated to (not a parent or child of) the target genre.
 */
function isGenreCompatible(track: RecoTrack, targetGenre: string): boolean {
  const text = `${track.artist} ${track.title}`.toLowerCase();
  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
    if (genre === targetGenre) continue;
    if (GENRE_PARENT[genre] === targetGenre) continue;
    if (GENRE_PARENT[targetGenre] === genre) continue;
    if (keywords.some((kw) => text.includes(kw))) return false;
  }
  return true;
}

function collectGenresFromText(
  text: string,
  score: Map<string, number>,
  weight: number,
): void {
  const src = normalizeText(text);
  if (!src) return;
  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
    if (keywords.some((keyword) => src.includes(normalizeText(keyword)))) {
      score.set(genre, (score.get(genre) ?? 0) + weight);
    }
  }
}

/** Ranks genres found in the user's own tracks. An artist mention counts double:
 *  listeners tend to follow an act more than a single song. */
function rankGenres(score: Map<string, number>, limit: number): string[] {
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre]) => genre);
}

function extractGenresFromTracks(
  tracks: readonly RecoTrack[],
  limit = 8,
): string[] {
  const score = new Map<string, number>();
  for (const track of tracks) {
    collectGenresFromText(track.title, score, 1);
    collectGenresFromText(track.artist, score, 2);
  }
  return rankGenres(score, limit);
}

function extractGenresFromAlbums(
  albums: readonly RecoAlbum[],
  limit = 8,
): string[] {
  const score = new Map<string, number>();
  for (const album of albums) {
    collectGenresFromText(album.title, score, 1);
    collectGenresFromText(album.artist, score, 2);
  }
  return rankGenres(score, limit);
}

/**
 * Decides which genres the user's feed is built from: what they actually listen
 * to, falling back to a stable per-user rotation when the library is empty.
 */
export function getUserGenres(params: {
  userId: number;
  hasHistory: boolean;
  recommendedTracks: readonly RecoTrack[];
  albumsForYou: readonly RecoAlbum[];
}): string[] {
  const { userId, hasHistory, recommendedTracks, albumsForYou } = params;
  if (!hasHistory) return getPersonalizedFallbackGenres(userId);

  const merged = [
    ...new Set([
      ...extractGenresFromTracks(recommendedTracks),
      ...extractGenresFromAlbums(albumsForYou),
    ]),
  ].slice(0, 8);
  return merged.length > 0 ? merged : getPersonalizedFallbackGenres(userId);
}

/** Tracks of the seed list that belong to `genre`, for prefilling a genre block. */
export function tracksMatchingGenre(
  tracks: readonly RecoTrack[],
  genre: string,
): RecoTrack[] {
  const keywords = GENRE_KEYWORDS[genre];
  if (!keywords) return [];
  return tracks.filter((track) => {
    const text = `${track.artist} ${track.title}`.toLowerCase();
    return keywords.some((keyword) => text.includes(keyword));
  });
}

/** Genre search pool: real songs of that genre, with a known length. */
export function filterGenrePool(
  songs: readonly RecoTrack[],
  genre: string,
): RecoTrack[] {
  return songs.filter(
    (track) =>
      normalizeDuration(track.duration) != null &&
      isGenreCompatible(track, genre),
  );
}
