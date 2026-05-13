import { Request, Response } from 'express';
import { AppDataSource } from '../services/dataSource';
import { FavoriteTrack } from '../entities/favorite-track.entity';
import { ListenHistory } from '../entities/listen-history.entity';
import { PlaylistTrack } from '../entities/playlist-track.entity';
import { TrackTag } from '../entities/track-tag.entity';
import { parseEnvelope, redisGetSWR, stringifyEnvelope } from '../services/cache-swr';
import { rewriteImageUrlsDeep } from '../services/image-proxy.service';
import { getRedis } from '../services/redis';
import { ytdlpService, type SearchResult } from '../services/ytdlp.service';
import { ytmusicService } from '../services/ytmusic.service';

type RecoTrack = {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  duration: number | string | null;
};

type RecoAlbum = {
  browseId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  year: string;
};

type RecoArtist = {
  browseId: string;
  name: string;
  thumbnailUrl: string;
  subscribers: string;
};

type HomeRecoResponse = {
  generatedAt: string;
  carousel: { pageSize: number; maxForwardPages: number };
  recommendedTracks: RecoTrack[];
  albumsForYou: RecoAlbum[];
  mixesForYou: Array<{
    id: string;
    title: string;
    subtitle: string;
    thumbnailUrl: string | null;
    artists: string[];
    previewThumbs?: string[];
  }>;
  similarTo: Array<{
    seedArtist: string;
    items: RecoArtist[];
  }>;
  byGenre: Array<{
    genre: string;
    tracks: RecoTrack[];
  }>;
};

const PAGE_SIZE = 6;
const MAX_FORWARD_PAGES = 2;
const MAX_RECO_SEEDS = 3;
const MAX_TOP_ARTISTS = 5;
const YTDLP_METADATA_CONCURRENCY = 3;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const TTL_RECO_HOME_SEC = envInt('REDIS_TTL_RECO_HOME_SEC', 14400);
const recoHomeInflightV2 = new Map<string, Promise<HomeRecoResponse>>();
const recoHomeInflightRefreshV2 = new Map<string, Promise<void>>();
const TTL_RECO_MIX_SEC = envInt('REDIS_TTL_RECO_MIX_SEC', TTL_RECO_HOME_SEC);

function hourBucketUtc(ts = new Date()): string {
  const y = ts.getUTCFullYear();
  const m = String(ts.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ts.getUTCDate()).padStart(2, '0');
  const h = String(ts.getUTCHours()).padStart(2, '0');
  return `${y}${m}${d}${h}`;
}

type MixTrackRow = {
  id: number;
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  duration: number | string | null;
};

function mixKey(params: { userId: number; hourBucket: string; n: number }): string {
  return `reco:mix:v2:${params.userId}:h:${params.hourBucket}:n:${params.n}`;
}
const TOP_GENRES = [
  'metal',
  'rock',
  'alternative',
  'indie',
  'pop',
  'hip hop',
  'rap',
  'electronic',
  'house',
  'ambient',
  'lofi',
  'jazz',
  'blues',
  'punk',
  'hard rock',
  'death metal',
  'black metal',
  'metalcore',
];

const FALLBACK_GENRES = [
  'pop',
  'rock',
  'electronic',
  'hip hop',
  'indie',
  'alternative',
  'r&b',
  'lofi',
  'jazz',
  'house',
];

function getPersonalizedFallbackGenres(userId: number): string[] {
  const shuffled = [...FALLBACK_GENRES];
  let seed = userId;
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 8);
}

/** More specific genres first — used in classification loops (first match wins). */
const GENRE_KEYWORDS: Record<string, string[]> = {
  'death metal': ['death metal', 'deathcore'],
  'black metal': ['black metal'],
  metalcore: ['metalcore'],
  metal: ['metal', 'thrash', 'doom', 'groove metal'],
  'hard rock': ['hard rock'],
  punk: ['punk', 'hardcore punk'],
  rock: ['rock', 'classic rock', 'post rock'],
  alternative: ['alternative', 'alt'],
  indie: ['indie', 'dream pop', 'shoegaze'],
  pop: ['pop', 'synthpop'],
  'hip hop': ['hip hop', 'hip-hop', 'boom bap'],
  rap: ['rap', 'trap', 'drill'],
  electronic: ['electronic', 'edm', 'electro'],
  house: ['house', 'tech house', 'deep house'],
  ambient: ['ambient', 'chill'],
  lofi: ['lofi', 'lo-fi'],
  jazz: ['jazz', 'fusion'],
  blues: ['blues'],
};

const GENRE_PARENT: Record<string, string> = {
  'death metal': 'metal',
  'black metal': 'metal',
  metalcore: 'metal',
  'hard rock': 'rock',
  punk: 'rock',
  house: 'electronic',
  ambient: 'electronic',
  rap: 'hip hop',
};

/**
 * Returns false if the track's artist/title contains keywords of a genre
 * that is unrelated to (not a parent/child of) the target genre.
 */
function isGenreCompatible(track: RecoTrack, targetGenre: string): boolean {
  const text = `${track.artist} ${track.title}`.toLowerCase();
  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
    if (genre === targetGenre) continue;
    if (GENRE_PARENT[genre] === targetGenre) continue;
    if (GENRE_PARENT[targetGenre] === genre) continue;
    if (keywords.some((kw) => text.includes(kw))) {
      return false;
    }
  }
  return true;
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isYoutubeVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id.trim());
}

function youtubeThumbnailFallbackUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId.trim()}/hqdefault.jpg`;
}

function normalizeDuration(duration: number | string | null | undefined): number | null {
  if (duration == null) return null;
  if (typeof duration === 'number') {
    if (!Number.isFinite(duration) || duration <= 0) return null;
    return duration > 86400 ? Math.round(duration / 1000) : Math.round(duration);
  }
  const trimmed = duration.trim();
  if (!trimmed) return null;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n > 86400 ? Math.round(n / 1000) : Math.round(n);
  }
  const parts = trimmed.split(':').map((p) => Number(p.trim()));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  if (parts.length === 2) return Math.round(parts[0]! * 60 + parts[1]!);
  if (parts.length === 3) return Math.round(parts[0]! * 3600 + parts[1]! * 60 + parts[2]!);
  return null;
}

function asRecoTrack(row: {
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

function takeUniqueTracks(rows: RecoTrack[], limit: number): RecoTrack[] {
  const out: RecoTrack[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const id = (row.trackId ?? '').trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(row);
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}

function takeUniqueByTrackId(rows: RecoTrack[]): RecoTrack[] {
  return takeUniqueTracks(rows, Number.MAX_SAFE_INTEGER);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = ((s * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function takeUniqueTracksShuffled(rows: RecoTrack[], limit: number, seed: number): RecoTrack[] {
  return takeUniqueTracks(seededShuffle(rows, seed), limit);
}

function isLikelyCompilation(track: RecoTrack): boolean {
  const dur = Number(track.duration);
  if (Number.isFinite(dur) && dur > 600) return true;
  const title = (track.title ?? '').toLowerCase();
  return ['top ', ' mix', 'stream', 'streaming', 'livestream', 'lofi', 'playlist', '24/7', 'radio', ' live', 'compilation', 'mega mix', 'non stop', 'greatest hits'].some((k) => title.includes(k));
}

function capArtists(rows: RecoTrack[], perArtistLimit: number, totalLimit: number): RecoTrack[] {
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

async function fillMissingTrackMedia<T extends RecoTrack>(rows: T[], maxLookup = 10): Promise<T[]> {
  const missing = rows.filter((row) => {
    const needsThumb = !row.thumbnailUrl || !row.thumbnailUrl.trim();
    const durNum = Number(row.duration) ?? NaN;
    const needsDuration = !Number.isFinite(durNum) || durNum <= 0;
    return !!row.trackId?.trim() && (needsThumb || needsDuration);
  });
  if (missing.length === 0) {
    return rows;
  }

  const byId = new Map<string, { thumbnailUrl: string; duration: number }>();
  const missingIds = [...new Set(missing.map((row) => row.trackId.trim()).filter(Boolean))].slice(0, maxLookup);

  if (missingIds.length > 0) {
    try {
      const songs = await ytmusicService.getSongsBatch(missingIds);
      for (const song of songs) {
        const thumbnailUrl = (song.thumbnailUrl ?? '').trim();
        const duration = Number.isFinite(song.duration) ? Math.floor(song.duration) : 0;
        if (thumbnailUrl || duration > 0) {
          byId.set(song.trackId, { thumbnailUrl, duration });
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[reco] ytmusic getSongsBatch failed', err);
      }
    }
  }

  const withThumbFallback = rows.map((row) => {
    const id = row.trackId?.trim() ?? '';
    const hasThumb = typeof row.thumbnailUrl === 'string' && row.thumbnailUrl.trim().length > 0;
    const hydratedThumb = (byId.get(id)?.thumbnailUrl ?? '').trim();
    if (hasThumb || hydratedThumb) {
      return row;
    }
    if (id && isYoutubeVideoId(id)) {
      return { ...row, thumbnailUrl: youtubeThumbnailFallbackUrl(id) } as T;
    }
    return row;
  });

  const stillMissingForYtdlp = [
    ...new Set(
      withThumbFallback
        .filter((row) => {
          const id = row.trackId?.trim() ?? '';
          if (!id) {
            return false;
          }
          const hasHydrated = byId.has(id);
          if (hasHydrated) {
            return false;
          }
          const needsThumb = !row.thumbnailUrl || !row.thumbnailUrl.trim();
          const durNum = Number(row.duration) ?? NaN;
          const needsDuration = !Number.isFinite(durNum) || durNum <= 0;
          return needsThumb || needsDuration;
        })
        .map((row) => row.trackId.trim()),
    ),
  ];

  for (let i = 0; i < stillMissingForYtdlp.length; i += YTDLP_METADATA_CONCURRENCY) {
    const chunk = stillMissingForYtdlp.slice(i, i + YTDLP_METADATA_CONCURRENCY);
    await Promise.all(
      chunk.map(async (trackId) => {
        try {
          const meta = await ytdlpService.getMetadata(trackId);
          const thumbnailUrl = (meta.thumbnailUrl ?? '').trim();
          const duration = Number.isFinite(meta.duration) ? Math.floor(meta.duration) : 0;
          if (thumbnailUrl || duration > 0) {
            byId.set(trackId, { thumbnailUrl, duration });
          }
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[reco] getMetadata failed for', trackId, err);
          }
        }
      }),
    );
  }

  if (byId.size === 0) {
    return withThumbFallback;
  }

  return withThumbFallback.map((row) => {
    const hydrated = byId.get(row.trackId);
    if (!hydrated) {
      return row;
    }
    const hasThumb = typeof row.thumbnailUrl === 'string' && row.thumbnailUrl.trim().length > 0;
    const durNum = Number(row.duration) ?? NaN;
    const hasDuration = Number.isFinite(durNum) && durNum > 0;
    return {
      ...row,
      thumbnailUrl: hasThumb ? row.thumbnailUrl : hydrated.thumbnailUrl || null,
      duration: hasDuration ? row.duration : hydrated.duration || null,
    } as T;
  });
}

async function buildRadioRecommendations(params: {
  seedTracks: RecoTrack[];
  excludeTrackIds: Set<string>;
  totalLimit: number;
}): Promise<RecoTrack[]> {
  const seedIds = takeUniqueByTrackId(params.seedTracks)
    .map((t) => t.trackId)
    .filter((id) => !!id && id.trim().length > 0)
    .slice(0, MAX_RECO_SEEDS);

  if (seedIds.length === 0) {
    return [];
  }

  const batch = await ytmusicService.getRadioBatch(seedIds, 60);
  const radios: RecoTrack[][] = [];
  for (const item of batch) {
    if (item.error) {
      radios.push([]);
      continue;
    }
    radios.push(
      item.tracks.map((t) => ({
        trackId: t.trackId,
        title: t.title,
        artist: t.artist,
        thumbnailUrl: t.thumbnailUrl || null,
        duration: Number.isFinite(t.duration) ? t.duration : null,
      })),
    );
  }

  const candidates = takeUniqueByTrackId(radios.flat()).filter((t) => !params.excludeTrackIds.has(t.trackId) && !isLikelyCompilation(t));
  return capArtists(candidates, 2, params.totalLimit);
}

function pickTopArtists(tracks: Array<{ artist: string }>, limit: number): string[] {
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

function collectGenresFromText(text: string, score: Map<string, number>, weight: number): void {
  const src = normalizeText(text);
  if (!src) {
    return;
  }
  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
    if (keywords.some((keyword) => src.includes(normalizeText(keyword)))) {
      score.set(genre, (score.get(genre) ?? 0) + weight);
    }
  }
}

async function extractGenresFromTracks(tracks: RecoTrack[]): Promise<string[]> {
  const score = new Map<string, number>();
  for (const track of tracks) {
    collectGenresFromText(track.title, score, 1);
    collectGenresFromText(track.artist, score, 2);
  }
  const ranked = [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([genre]) => genre);
  return ranked.slice(0, 8);
}

function extractGenresFromAlbums(albums: RecoAlbum[]): string[] {
  const score = new Map<string, number>();
  for (const album of albums) {
    collectGenresFromText(album.title, score, 1);
    collectGenresFromText(album.artist, score, 2);
  }
  const ranked = [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([genre]) => genre);
  return ranked.slice(0, 8);
}

async function getUserGenres(params: {
  userId: number;
  hasHistory: boolean;
  recommendedTracks: RecoTrack[];
  albumsForYou: RecoAlbum[];
}): Promise<string[]> {
  const { userId, hasHistory, recommendedTracks, albumsForYou } = params;

  if (!hasHistory) {
    return getPersonalizedFallbackGenres(userId);
  }

  const trackGenres = await extractGenresFromTracks(recommendedTracks);
  const albumGenres = extractGenresFromAlbums(albumsForYou);

  const merged = [...new Set([...trackGenres, ...albumGenres])].slice(0, 8);

  if (merged.length > 0) {
    return merged;
  }

  return getPersonalizedFallbackGenres(userId);
}

async function buildGenreTrackBlocks(
  genres: string[],
  topArtists: string[],
  varietySeed: number,
  recommendedTracks?: RecoTrack[],
  usedTrackIds?: Set<string>,
  usedArtistNames?: Set<string>,
): Promise<Array<{ genre: string; tracks: RecoTrack[] }>> {
  const slice = genres.slice(0, 3);
  const blockUsedTrackIds = new Set(usedTrackIds);
  const blockUsedArtists = new Set(usedArtistNames);

  const recosByGenre = new Map<string, RecoTrack[]>();
  if (recommendedTracks) {
    for (const t of recommendedTracks) {
      if (isLikelyCompilation(t)) continue;
      for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
        if (keywords.some((k) => (t.artist + ' ' + t.title).toLowerCase().includes(k))) {
          if (!recosByGenre.has(genre)) recosByGenre.set(genre, []);
          recosByGenre.get(genre)!.push(t);
          break;
        }
      }
    }
  }

  const blocks: Array<{ genre: string; tracks: RecoTrack[] }> = [];
  for (let idx = 0; idx < slice.length; idx++) {
    const genre = slice[idx]!;
    const buildBlock = async (): Promise<{ genre: string; tracks: RecoTrack[] } | null> => {
      try {
        const songs = await ytmusicService.searchSongs(`${genre} music`);
        const limit = PAGE_SIZE * (MAX_FORWARD_PAGES + 1);
        let pool = (songs ?? []).map(asRecoTrack).filter(
          (t) => !isLikelyCompilation(t) && Number(t.duration) > 0 && isGenreCompatible(t, genre),
        );
        const recos = recosByGenre.get(genre) || [];
        if (recos.length > 0) {
          pool = [...recos.filter((r) => !pool.some((p) => p.trackId === r.trackId)), ...pool];
        }
        pool = pool.filter((t) => !blockUsedTrackIds.has(t.trackId) && !blockUsedArtists.has(t.artist.trim().toLowerCase()));
        const tracks = takeUniqueTracksShuffled(pool, limit, varietySeed + idx);
        return tracks.length > 0 ? { genre, tracks } : null;
      } catch {
        try {
          const songs = await ytmusicService.searchSongs(`${genre} music`);
          const limit = PAGE_SIZE * (MAX_FORWARD_PAGES + 1);
          let pool = (songs ?? []).map(asRecoTrack).filter(
            (t) => !isLikelyCompilation(t) && isGenreCompatible(t, genre),
          );
          const recos = recosByGenre.get(genre) || [];
          if (recos.length > 0) {
            pool = [...recos.filter((r) => !pool.some((p) => p.trackId === r.trackId)), ...pool];
          }
          pool = pool.filter((t) => !blockUsedTrackIds.has(t.trackId) && !blockUsedArtists.has(t.artist.trim().toLowerCase()));
          const tracks = takeUniqueTracksShuffled(pool, limit, varietySeed + idx);
          return tracks.length > 0 ? { genre, tracks } : null;
        } catch {
          return null;
        }
      }
    };
    const block = await buildBlock();
    if (block) {
      for (const t of block.tracks) {
        blockUsedTrackIds.add(t.trackId);
        blockUsedArtists.add(t.artist.trim().toLowerCase());
      }
      blocks.push(block);
    }
  }
  return blocks;
}

async function buildSimilarArtistBlocks(artists: string[]): Promise<Array<{ seedArtist: string; items: RecoArtist[] }>> {
  const seeds = artists.slice(0, 3).filter((a) => a?.trim());
  if (seeds.length === 0) return [];

  const redis = getRedis();
  const seenBrowseIds = new Set<string>();
  const results = await Promise.all(
    seeds.map(async (seed) => {
      const cacheKey = `reco:similarTo:v2:${seed}`;
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const block = JSON.parse(cached) as { seedArtist: string; items: RecoArtist[] } | null;
          if (block) {
            block.items = block.items.filter((a) => a.browseId && !seenBrowseIds.has(a.browseId));
            for (const a of block.items) seenBrowseIds.add(a.browseId);
            return block.items.length > 0 ? block : null;
          }
        }
      } catch {}

      try {
        const hits = await ytmusicService.searchArtists(seed);
        const browseId = hits[0]?.browseId;
        if (!browseId) return null;
        const detail = await ytmusicService.getArtist(browseId);
        const related = (detail?.relatedArtists ?? [])
          .filter((row) => row.browseId && row.name && !seenBrowseIds.has(row.browseId))
          .slice(0, PAGE_SIZE * (MAX_FORWARD_PAGES + 1))
          .map((row) => ({
            browseId: row.browseId,
            name: row.name,
            thumbnailUrl: row.thumbnailUrl,
            subscribers: row.subscribers,
          }));
        if (related.length === 0) return null;
        for (const a of related) seenBrowseIds.add(a.browseId);
        const block = { seedArtist: seed, items: related };
        redis.set(cacheKey, JSON.stringify(block), 'EX', 86400).catch(() => {});
        return block;
      } catch {
        return null;
      }
    }),
  );

  return results.filter((x): x is { seedArtist: string; items: RecoArtist[] } => x !== null);
}

function buildMixesForYou(artists: string[], genreBlocks: Array<{ genre: string; tracks: RecoTrack[] }>): HomeRecoResponse['mixesForYou'] {
  const mixes: HomeRecoResponse['mixesForYou'] = [];
  const artistGroups = [artists.slice(0, 3), artists.slice(1, 4), artists.slice(2, 5)];
  let idx = 1;
  for (const group of artistGroups) {
    const artistsInMix = group.filter((name) => !!name.trim());
    if (artistsInMix.length < 3) {
      continue;
    }
    const seedGenre = genreBlocks[(idx - 1) % Math.max(genreBlocks.length, 1)]?.genre ?? 'mix';
    const thumb = genreBlocks[(idx - 1) % Math.max(genreBlocks.length, 1)]?.tracks[0]?.thumbnailUrl ?? null;
    mixes.push({
      id: `mix-${idx}`,
      title: `Mix for you #${idx}`,
      subtitle: artistsInMix.join(', '),
      thumbnailUrl: thumb,
      artists: artistsInMix,
    });
    idx += 1;
  }
  return mixes;
}

async function getPopularFallbackTracks(varietySeed: number): Promise<RecoTrack[]> {
  const candidates = ['top songs 2026', 'popular songs'];
  const results = await Promise.all(
    candidates.map(async (query) => {
      try {
        const songs = await ytmusicService.searchSongs(query);
        return (songs ?? []).map(asRecoTrack).filter((t) => !isLikelyCompilation(t));
      } catch {
        return [] as RecoTrack[];
      }
    }),
  );
  return takeUniqueTracksShuffled(results.flat(), PAGE_SIZE * (MAX_FORWARD_PAGES + 1), varietySeed);
}

function toSearchRows(rows: RecoTrack[]): SearchResult[] {
  return rows.map((row) => ({
    trackId: row.trackId,
    title: row.title,
    artist: row.artist,
    thumbnailUrl: row.thumbnailUrl ?? '',
    duration: row.duration ?? 0,
  }));
}

function writeHomeNdjson(res: Response, obj: unknown): void {
  res.write(`${JSON.stringify(rewriteImageUrlsDeep(obj))}\n`);
}

function streamHomeRecoPayload(res: Response, payload: HomeRecoResponse): void {
  writeHomeNdjson(res, {
    kind: 'meta',
    generatedAt: payload.generatedAt,
    carousel: payload.carousel,
  });
  writeHomeNdjson(res, { kind: 'recommendedTracks', items: payload.recommendedTracks });
  writeHomeNdjson(res, { kind: 'mixesForYou', items: payload.mixesForYou });
  writeHomeNdjson(res, { kind: 'similarTo', items: payload.similarTo });
  writeHomeNdjson(res, { kind: 'byGenre', items: payload.byGenre });
  writeHomeNdjson(res, { kind: 'albumsForYou', items: payload.albumsForYou });
}

async function buildAlbumsBlock(params: {
  topArtists: string[];
  recommendedTracks: RecoTrack[];
  userId?: number;
}): Promise<RecoAlbum[]> {
  const { topArtists, recommendedTracks } = params;
  const albumsForYou: RecoAlbum[] = [];
  const maxAlbums = PAGE_SIZE * (MAX_FORWARD_PAGES + 1);
  const seenArtistNames = new Set<string>();

  const pushUnique = (row: { browseId: string; title: string; artist: string; thumbnailUrl: string; year: string }) => {
    if (!row.browseId || !row.title) return;
    if (albumsForYou.some((a) => a.browseId === row.browseId)) return;
    const artistNorm = (row.artist ?? '').trim().toLowerCase();
    if (!artistNorm || seenArtistNames.has(artistNorm)) return;
    seenArtistNames.add(artistNorm);
    albumsForYou.push({
      browseId: row.browseId,
      title: row.title,
      artist: row.artist,
      thumbnailUrl: row.thumbnailUrl,
      year: row.year,
    });
  };

  const batchTop = await ytmusicService.searchAlbumsBatch(topArtists.slice(0, 8));
  for (const pack of batchTop) {
    for (const row of (pack.albums ?? []).slice(0, 3)) {
      pushUnique(row);
      if (albumsForYou.length >= maxAlbums) return albumsForYou;
    }
  }

  if (albumsForYou.length === 0) {
    try {
      const fallbackArtists = pickTopArtists(toSearchRows(recommendedTracks), 2);
      if (fallbackArtists.length > 0) {
        const fbBatch = await ytmusicService.searchAlbumsBatch(fallbackArtists);
        for (const pack of fbBatch) {
          for (const row of (pack.albums ?? []).slice(0, 3)) pushUnique(row);
        }
      }
      if (albumsForYou.length === 0 && params.userId) {
        const fallbackGenres = getPersonalizedFallbackGenres(params.userId);
        const genreIdx = (params.userId * 7 + new Date().getUTCHours()) % fallbackGenres.length;
        const genre = fallbackGenres[genreIdx] || 'pop';
        const rows = await ytmusicService.searchAlbums(`${genre}`);
        for (const row of rows.slice(0, PAGE_SIZE)) pushUnique(row);
      }
    } catch {}
  }

  return albumsForYou;
}

async function buildHomeRecoPayload(userId: number): Promise<HomeRecoResponse> {
  const [historyRows, favoriteRows, playlistRows, tagRows] = await Promise.all([
    AppDataSource.getRepository(ListenHistory).find({
      where: { user: { id: userId } },
      order: { listenedAt: 'DESC' },
      take: 120,
    }),
    AppDataSource.getRepository(FavoriteTrack).find({
      where: { user: { id: userId } },
      order: { addedAt: 'DESC' },
      take: 120,
    }),
    AppDataSource.getRepository(PlaylistTrack)
      .createQueryBuilder('pt')
      .innerJoin('pt.playlist', 'p')
      .where('p.user_id = :uid', { uid: userId })
      .orderBy('pt.addedAt', 'DESC')
      .take(120)
      .getMany(),
    AppDataSource.getRepository(TrackTag).find({
      where: { user: { id: userId } },
      order: { addedAt: 'DESC' },
      take: 120,
    }),
  ]);

  const recommendedPool: RecoTrack[] = [
    ...historyRows.map(asRecoTrack),
    ...favoriteRows.map(asRecoTrack),
    ...playlistRows.map(asRecoTrack),
    ...tagRows.map(asRecoTrack),
  ];
  const recentTrackIds = new Set<string>();
  for (const row of historyRows.slice(0, 120)) {
    const id = (row.trackId ?? '').trim();
    if (id) {
      recentTrackIds.add(id);
    }
  }

  const hasHistory = historyRows.length > 0 || favoriteRows.length > 0 || playlistRows.length > 0;
  const seedTracks = takeUniqueTracks(recommendedPool, 40);
  const topArtists = pickTopArtists(seedTracks, MAX_TOP_ARTISTS);
  const varietySeed = (userId * 31 + Number(hourBucketUtc())) >>> 0;

  const radioPromise = seedTracks.length > 0
    ? buildRadioRecommendations({
        seedTracks,
        excludeTrackIds: recentTrackIds,
        totalLimit: PAGE_SIZE * (MAX_FORWARD_PAGES + 1),
      })
    : Promise.resolve([] as RecoTrack[]);

  type SimilarBlock = { seedArtist: string; items: RecoArtist[] };
  type GenreBlock = { genre: string; tracks: RecoTrack[] };

  const [radioResult, similarTo, albumsForYou, fallbackTracks, popularTracks] = await Promise.all([
    radioPromise,
    buildSimilarArtistBlocks(topArtists).catch(() => [] as SimilarBlock[]),
    buildAlbumsBlock({ topArtists, recommendedTracks: [], userId }).catch(() => [] as RecoAlbum[]),
    Promise.resolve(takeUniqueTracks(recommendedPool, PAGE_SIZE * (MAX_FORWARD_PAGES + 1))),
    getPopularFallbackTracks(varietySeed).catch(() => [] as RecoTrack[]),
  ]);

  let recommendedTracks: RecoTrack[] = radioResult;

  if (recommendedTracks.length < 8) {
    recommendedTracks = takeUniqueTracks([...recommendedTracks, ...fallbackTracks, ...popularTracks], PAGE_SIZE * (MAX_FORWARD_PAGES + 1));
  }

  recommendedTracks = await fillMissingTrackMedia(recommendedTracks, PAGE_SIZE * (MAX_FORWARD_PAGES + 1));

  const finalGenres = await getUserGenres({ userId, hasHistory, recommendedTracks, albumsForYou });

  const recoTrackIds = new Set(recommendedTracks.map((t) => t.trackId));
  const recoArtistNames = new Set(recommendedTracks.map((t) => t.artist.trim().toLowerCase()));

  const [byGenre, mixesForYou] = await Promise.all([
    buildGenreTrackBlocks(finalGenres, topArtists, varietySeed, recommendedTracks, recoTrackIds, recoArtistNames).catch(() => [] as GenreBlock[]),
    buildRegeneratedMixesFast({ userId, hourBucket: hourBucketUtc(), genres: finalGenres, usedIds: recentTrackIds, varietySeed }).catch(() => []),
  ]);

  const hydrated = recommendedTracks.map((t) => ({
    ...t,
    thumbnailUrl: t.thumbnailUrl || (isYoutubeVideoId(t.trackId) ? youtubeThumbnailFallbackUrl(t.trackId) : null),
  }));

  return {
    generatedAt: new Date().toISOString(),
    carousel: {
      pageSize: PAGE_SIZE,
      maxForwardPages: MAX_FORWARD_PAGES,
    },
    recommendedTracks: hydrated,
    albumsForYou,
    mixesForYou: mixesForYou.length > 0 ? mixesForYou : buildMixesForYou(topArtists, byGenre),
    similarTo,
    byGenre,
  };
}

export async function getRecoHome(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const key = `reco:home:v4:${userId}:h:${hourBucketUtc()}`;
  const accept = String(req.headers.accept ?? '');
  const wantsStream = accept.includes('application/x-ndjson');

  try {
    if (!wantsStream) {
      const payload = await redisGetSWR<HomeRecoResponse>(
        key,
        TTL_RECO_HOME_SEC,
        undefined,
        () => buildHomeRecoPayload(userId),
        recoHomeInflightV2,
        recoHomeInflightRefreshV2,
      );
      return res.json(payload);
    }

    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    const redis = getRedis();
    const cachedRaw = await redis.get(key);
    if (cachedRaw) {
      const env = parseEnvelope<HomeRecoResponse>(cachedRaw);
      if (env?.data) {
        streamHomeRecoPayload(res, env.data);
        writeHomeNdjson(res, { kind: 'done' });
        return res.end();
      }
    }

    const payload = await redisGetSWR<HomeRecoResponse>(
      key,
      TTL_RECO_HOME_SEC,
      undefined,
      () => buildHomeRecoPayload(userId),
      recoHomeInflightV2,
      recoHomeInflightRefreshV2,
    );

    streamHomeRecoPayload(res, payload);
    writeHomeNdjson(res, { kind: 'done' });
    return res.end();
  } catch (err) {
    console.error(err);
    if (res.headersSent) {
      return res.end();
    }
    return res.status(502).json({ message: 'Failed to load recommendations' });
  }
}

async function buildRegeneratedMixesFast(params: {
  userId: number;
  hourBucket: string;
  genres: string[];
  usedIds: Set<string>;
  varietySeed?: number;
}): Promise<HomeRecoResponse['mixesForYou']> {
  const { userId, hourBucket, genres, usedIds, varietySeed = 0 } = params;
  const totalMixTracks = PAGE_SIZE * (MAX_FORWARD_PAGES + 1);

  let mixGenres = genres.slice(0, 3);
  while (mixGenres.length < 3 && genres.length > 0) {
    mixGenres.push(genres[mixGenres.length % genres.length]);
  }
  if (mixGenres.length === 0) {
    mixGenres = ['pop', 'rock', 'electronic'];
  }

  const rawResults = await Promise.all(
    mixGenres.map(async (genre) => {
      try {
        return await ytmusicService.searchSongs(`${genre} music`);
      } catch {
        return null;
      }
    }),
  );

  const allTracks = rawResults.filter((x): x is NonNullable<(typeof rawResults)[number]> => x != null).flat().map(asRecoTrack).filter((t) => !isLikelyCompilation(t));
  const seen = new Set<string>(usedIds);

  const cards: HomeRecoResponse['mixesForYou'] = [];
  for (let n = 0; n < Math.min(rawResults.length, 3); n++) {
    const genreTracks = (rawResults[n] ?? []).map(asRecoTrack).filter((t) => !isLikelyCompilation(t));
    let mixTracks = takeUniqueTracksShuffled(genreTracks.filter((t) => !seen.has(t.trackId)), totalMixTracks, varietySeed + n);
    if (mixTracks.length < 6) {
      const extras = allTracks.filter((t) => !seen.has(t.trackId));
      mixTracks = takeUniqueTracksShuffled([...mixTracks, ...extras], totalMixTracks, varietySeed + n * 7);
    }
    if (mixTracks.length < 3) continue;

    for (const t of mixTracks) { usedIds.add(t.trackId); seen.add(t.trackId); }

    const rows: MixTrackRow[] = mixTracks.map((t, idx) => ({
      id: idx + 1,
      trackId: t.trackId,
      title: t.title,
      artist: t.artist,
      thumbnailUrl: t.thumbnailUrl || (isYoutubeVideoId(t.trackId) ? youtubeThumbnailFallbackUrl(t.trackId) : null),
      duration: t.duration ?? null,
    }));

    getRedis().set(mixKey({ userId, hourBucket, n: n + 1 }), JSON.stringify(rows), 'EX', TTL_RECO_MIX_SEC).catch(() => {});

    const thumbs = rows.filter((r) => r.thumbnailUrl).map((r) => r.thumbnailUrl as string).slice(0, 4);
    cards.push({
      id: `${hourBucket}-${n + 1}`,
      title: `Mix #${n + 1}`,
      subtitle: pickTopArtists(rows, 4).join(', '),
      thumbnailUrl: thumbs[0] ?? null,
      artists: pickTopArtists(rows, 4),
      previewThumbs: thumbs,
    });
  }

  return cards;
}

export async function regenerateMixes(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const hb = hourBucketUtc();
  const redis = getRedis();
  const cacheKey = `reco:home:v4:${userId}:h:${hb}`;
  recoHomeInflightV2.delete(cacheKey);
  recoHomeInflightRefreshV2.delete(cacheKey);

  try {
    const existingMixes: HomeRecoResponse['mixesForYou'] = [];
    for (let n = 1; n <= 3; n++) {
      const raw = await redis.get(mixKey({ userId, hourBucket: hb, n }));
      if (raw) {
        const rows = JSON.parse(raw) as MixTrackRow[];
        const thumbs = rows.filter((r) => r.thumbnailUrl).map((r) => r.thumbnailUrl as string).slice(0, 4);
        existingMixes.push({
          id: `${hb}-${n}`,
          title: `Mix #${n}`,
          subtitle: pickTopArtists(rows, 4).join(', '),
          thumbnailUrl: thumbs[0] ?? null,
          artists: pickTopArtists(rows, 4),
          previewThumbs: thumbs,
        });
      }
    }
    if (existingMixes.length === 3) {
      return res.json({ mixes: existingMixes });
    }

    const [favRows, historyRows, tagRows] = await Promise.all([
      AppDataSource.getRepository(FavoriteTrack).find({
        where: { user: { id: userId } },
        order: { addedAt: 'DESC' },
        take: 120,
      }),
      AppDataSource.getRepository(ListenHistory).find({
        where: { user: { id: userId } },
        order: { listenedAt: 'DESC' },
        take: 120,
      }),
      AppDataSource.getRepository(TrackTag).find({
        where: { user: { id: userId } },
        order: { addedAt: 'DESC' },
        take: 120,
      }),
    ]);

    const usedIds = new Set<string>();
    for (const row of historyRows.slice(0, 30)) {
      const id = (row.trackId ?? '').trim();
      if (id) usedIds.add(id);
    }

    const seedTracks = takeUniqueTracks(
      [...favRows.map(asRecoTrack), ...historyRows.map(asRecoTrack), ...tagRows.map(asRecoTrack)],
      40,
    );

    const finalGenres = await getUserGenres({ userId, hasHistory: true, recommendedTracks: seedTracks, albumsForYou: [] });

    const mixes = await buildRegeneratedMixesFast({ userId, hourBucket: hb, genres: finalGenres, usedIds, varietySeed: (userId * 31 + Number(hb)) >>> 0 });
    console.log('[regenerateMixes] fast mixes count:', mixes.length);

    return res.json({ mixes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to generate mixes' });
  }
}

export async function getRecoMix(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const paramId = req.params.id;
  const rawId = (typeof paramId === 'string' ? paramId : '').trim();
  const m = /^(\d{10})-(\d+)$/.exec(rawId);
  if (!m) {
    return res.status(400).json({ message: 'Bad mix id' });
  }
  const hourBucket = m[1];
  const n = Number.parseInt(m[2], 10);
  if (!Number.isFinite(n) || n < 1 || n > 5) {
    return res.status(400).json({ message: 'Bad mix id' });
  }
  const redis = getRedis();
  const raw = await redis.get(mixKey({ userId, hourBucket, n }));
  if (!raw) {
    return res.status(404).json({ message: 'Mix not found' });
  }
  try {
    const rows = JSON.parse(raw) as MixTrackRow[];
    const hydratedRows = await fillMissingTrackMedia(rows, 12);
    if (hydratedRows.some((row, idx) => row.thumbnailUrl !== rows[idx]?.thumbnailUrl || row.duration !== rows[idx]?.duration)) {
      try {
        await redis.set(mixKey({ userId, hourBucket, n }), JSON.stringify(hydratedRows), 'EX', TTL_RECO_MIX_SEC);
      } catch {
        /* ignore */
      }
    }
    return res.json(hydratedRows);
  } catch {
    return res.status(500).json({ message: 'Mix cache corrupted' });
  }
}
