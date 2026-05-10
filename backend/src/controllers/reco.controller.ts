import { Request, Response } from 'express';
import { AppDataSource } from '../services/dataSource';
import { FavoriteTrack } from '../entities/favorite-track.entity';
import { ListenHistory } from '../entities/listen-history.entity';
import { PlaylistTrack } from '../entities/playlist-track.entity';
import { TrackTag } from '../entities/track-tag.entity';
import { UserMixPreferences } from '../entities/user-mix-preferences.entity';
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
  duration: number | null;
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
const MAX_RECO_SEEDS = 8;
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
  duration: number | null;
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

function getPersonalizedFallbackGenres(userId: number): string[] {
  const shuffled = [...TOP_GENRES];
  let seed = userId;
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 8);
}

const GENRE_KEYWORDS: Record<string, string[]> = {
  metal: ['metal', 'thrash', 'doom', 'groove metal', 'death metal', 'black metal', 'metalcore'],
  rock: ['rock', 'hard rock', 'classic rock', 'post rock'],
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
  punk: ['punk', 'hardcore punk'],
  'hard rock': ['hard rock'],
  'death metal': ['death metal', 'deathcore'],
  'black metal': ['black metal'],
  metalcore: ['metalcore'],
};

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

function asRecoTrack(row: {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  duration?: number | null;
}): RecoTrack {
  return {
    trackId: row.trackId,
    title: row.title,
    artist: row.artist,
    thumbnailUrl: row.thumbnailUrl ?? null,
    duration: row.duration ?? null,
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
    const needsDuration = !Number.isFinite(row.duration ?? NaN) || (row.duration ?? 0) <= 0;
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
          const needsDuration = !Number.isFinite(row.duration ?? NaN) || (row.duration ?? 0) <= 0;
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
    const hasDuration = Number.isFinite(row.duration ?? NaN) && (row.duration ?? 0) > 0;
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

  const candidates = takeUniqueByTrackId(radios.flat()).filter((t) => !params.excludeTrackIds.has(t.trackId));
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

async function buildGenreTrackBlocks(genres: string[]): Promise<Array<{ genre: string; tracks: RecoTrack[] }>> {
  const slice = genres.slice(0, 3);
  const blocks = await Promise.all(
    slice.map(async (genre) => {
      try {
        const bundle = await ytdlpService.search(`${genre} music`);
        const tracks = takeUniqueTracks(bundle.tracks.map(asRecoTrack), PAGE_SIZE * (MAX_FORWARD_PAGES + 1));
        return tracks.length > 0 ? { genre, tracks } : null;
      } catch {
        return null;
      }
    }),
  );
  return blocks.filter((x): x is { genre: string; tracks: RecoTrack[] } => x !== null);
}

async function buildSimilarArtistBlocks(artists: string[]): Promise<Array<{ seedArtist: string; items: RecoArtist[] }>> {
  const seed = artists[0]?.trim();
  if (!seed) {
    return [];
  }
  try {
    const hits = await ytmusicService.searchArtists(seed);
    const browseId = hits[0]?.browseId;
    if (!browseId) {
      return [];
    }
    const detail = await ytmusicService.getArtist(browseId);
    const related = (detail?.relatedArtists ?? [])
      .filter((row) => row.browseId && row.name)
      .slice(0, PAGE_SIZE * (MAX_FORWARD_PAGES + 1))
      .map((row) => ({
        browseId: row.browseId,
        name: row.name,
        thumbnailUrl: row.thumbnailUrl,
        subscribers: row.subscribers,
      }));
    if (related.length === 0) {
      return [];
    }
    return [{ seedArtist: seed, items: related }];
  } catch {
    return [];
  }
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
      title: `Микс для вас #${idx}`,
      subtitle: artistsInMix.join(', '),
      thumbnailUrl: thumb,
      artists: artistsInMix,
    });
    idx += 1;
  }
  return mixes;
}

async function getSlotGenres(userId: number): Promise<string[]> {
  const row = await AppDataSource.getRepository(UserMixPreferences).findOne({
    where: { user: { id: userId } },
  });
  const slots = row?.slots ?? {};
  const out: string[] = [];
  for (const value of Object.values(slots)) {
    if (!value || typeof value !== 'object') {
      continue;
    }
    const genres = (value as { genres?: unknown }).genres;
    if (!Array.isArray(genres)) {
      continue;
    }
    for (const genre of genres) {
      if (typeof genre !== 'string') continue;
      const trimmed = genre.trim().toLowerCase();
      if (!trimmed || out.includes(trimmed)) continue;
      out.push(trimmed);
      if (out.length >= 8) return out;
    }
  }
  return out;
}

async function getPopularFallbackTracks(): Promise<RecoTrack[]> {
  const candidates = ['top music 2026', 'youtube music hits', 'popular songs'];
  for (const query of candidates) {
    try {
      const bundle = await ytdlpService.search(query);
      const tracks = takeUniqueTracks(bundle.tracks.map(asRecoTrack), PAGE_SIZE * (MAX_FORWARD_PAGES + 1));
      if (tracks.length > 0) {
        return tracks;
      }
    } catch {
      // Try next query.
    }
  }
  return [];
}

async function buildGenreBasedFallback(genres: string[], limit: number): Promise<RecoTrack[]> {
  const genreSlice = genres.slice(0, 4);
  const results = await Promise.all(
    genreSlice.map(async (genre) => {
      try {
        const bundle = await ytdlpService.search(`${genre} music`);
        return takeUniqueTracks(bundle.tracks.map(asRecoTrack), 30);
      } catch {
        return [];
      }
    }),
  );
  return takeUniqueTracks(results.flat(), limit);
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

async function buildMixCardsForUser(params: {
  userId: number;
  hourBucket: string;
  seedTracks: RecoTrack[];
  recentTrackIds: Set<string>;
  finalGenres: string[];
}): Promise<HomeRecoResponse['mixesForYou']> {
  const { userId, hourBucket, seedTracks, recentTrackIds, finalGenres } = params;
  const totalMixTracks = PAGE_SIZE * (MAX_FORWARD_PAGES + 1);

  const cards = await Promise.all(
    [1, 2, 3].map(async (n) => {
      const seedSlice = seedTracks.slice((n - 1) * 6, (n - 1) * 6 + 12);
      let mixTracks: RecoTrack[] = [];

      if (seedSlice.length > 0) {
        mixTracks = await buildRadioRecommendations({
          seedTracks: seedSlice,
          excludeTrackIds: recentTrackIds,
          totalLimit: totalMixTracks,
        });
      }

      if (mixTracks.length === 0 && finalGenres.length > 0) {
        const genre = finalGenres[(n - 1) % finalGenres.length];
        const bundle = await ytdlpService.search(`${genre} music`);
        mixTracks = takeUniqueTracks(bundle.tracks.map(asRecoTrack), totalMixTracks);
      }

      if (mixTracks.length === 0) {
        return null;
      }

      const rows: MixTrackRow[] = mixTracks.map((t, idx) => ({
        id: idx + 1,
        trackId: t.trackId,
        title: t.title,
        artist: t.artist,
        thumbnailUrl: t.thumbnailUrl,
        duration: t.duration,
      }));
      const hydratedRows = await fillMissingTrackMedia(rows, 12);
      try {
        await getRedis().set(mixKey({ userId, hourBucket, n }), JSON.stringify(hydratedRows), 'EX', TTL_RECO_MIX_SEC);
      } catch {
        /* ignore */
      }
      const thumbs = hydratedRows
        .map((r) => r.thumbnailUrl)
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .slice(0, 4);
      return {
        id: `${hourBucket}-${n}`,
        title: `Микс #${n}`,
        subtitle: pickTopArtists(hydratedRows, 4).join(', '),
        thumbnailUrl: thumbs[0] ?? null,
        artists: pickTopArtists(hydratedRows, 4),
        previewThumbs: thumbs,
      };
    }),
  );
  return cards.filter((x): x is NonNullable<(typeof cards)[number]> => x !== null);
}

async function buildAlbumsBlock(params: {
  topArtists: string[];
  recommendedTracks: RecoTrack[];
}): Promise<RecoAlbum[]> {
  const { topArtists, recommendedTracks } = params;
  const albumsForYou: RecoAlbum[] = [];
  const maxAlbums = PAGE_SIZE * (MAX_FORWARD_PAGES + 1);

  const pushUnique = (row: { browseId: string; title: string; artist: string; thumbnailUrl: string; year: string }) => {
    if (!row.browseId || !row.title) {
      return;
    }
    if (albumsForYou.some((a) => a.browseId === row.browseId)) {
      return;
    }
    albumsForYou.push({
      browseId: row.browseId,
      title: row.title,
      artist: row.artist,
      thumbnailUrl: row.thumbnailUrl,
      year: row.year,
    });
  };

  const batchTop = await ytmusicService.searchAlbumsBatch(topArtists.slice(0, 4));
  for (const pack of batchTop) {
    for (const row of (pack.albums ?? []).slice(0, 3)) {
      pushUnique(row);
      if (albumsForYou.length >= maxAlbums) {
        return albumsForYou;
      }
    }
  }

  const topArtistSet = new Set<string>(topArtists.map((a) => normalizeText(a)));
  const seedArtist = topArtists[0];
  if (seedArtist && albumsForYou.length < maxAlbums) {
    try {
      const hits = await ytmusicService.searchArtists(seedArtist);
      const seedBrowseId = hits[0]?.browseId;
      if (seedBrowseId) {
        const detail = await ytmusicService.getArtist(seedBrowseId);
        const related = (detail?.relatedArtists ?? []).slice(0, 8);
        const relNames = related
          .map((r) => r.name?.trim())
          .filter((n): n is string => !!n && !topArtistSet.has(normalizeText(n)));
        if (relNames.length > 0) {
          const relBatch = await ytmusicService.searchAlbumsBatch(relNames.slice(0, 8));
          for (const pack of relBatch) {
            for (const row of (pack.albums ?? []).slice(0, 2)) {
              pushUnique(row);
              if (albumsForYou.length >= maxAlbums) {
                return albumsForYou;
              }
            }
          }
        }
      }
    } catch {
      // best effort
    }
  }

  if (albumsForYou.length === 0) {
    try {
      const fallbackArtists = pickTopArtists(toSearchRows(recommendedTracks), 2);
      if (fallbackArtists.length > 0) {
        const fbBatch = await ytmusicService.searchAlbumsBatch(fallbackArtists);
        for (const pack of fbBatch) {
          for (const row of (pack.albums ?? []).slice(0, 3)) {
            pushUnique(row);
          }
        }
      }
      if (albumsForYou.length === 0) {
        const bundles = await ytdlpService.search('popular metal albums');
        if (bundles.tracks.length > 0) {
          const rows = await ytmusicService.searchAlbums(bundles.tracks[0].artist);
          for (const row of rows.slice(0, PAGE_SIZE)) {
            pushUnique(row);
          }
        }
      }
    } catch {
      /* empty ok */
    }
  }

  return albumsForYou;
}

async function buildHomeRecoPayload(userId: number): Promise<HomeRecoResponse> {
  const [historyRows, favoriteRows, playlistRows, tagRows, slotGenres] = await Promise.all([
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
    getSlotGenres(userId),
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

  let recommendedTracks: RecoTrack[] = [];

  if (seedTracks.length > 0) {
    recommendedTracks = await buildRadioRecommendations({
      seedTracks,
      excludeTrackIds: recentTrackIds,
      totalLimit: PAGE_SIZE * (MAX_FORWARD_PAGES + 1),
    });
  }

  if (recommendedTracks.length < 8) {
    const fallback = takeUniqueTracks(recommendedPool, PAGE_SIZE * (MAX_FORWARD_PAGES + 1));
    recommendedTracks = takeUniqueTracks([...recommendedTracks, ...fallback, ...(await getPopularFallbackTracks())], PAGE_SIZE * (MAX_FORWARD_PAGES + 1));
  }
  recommendedTracks = await fillMissingTrackMedia(recommendedTracks, 12);

  const hb = hourBucketUtc();

  const [similarTo, albumsForYou] = await Promise.all([
    buildSimilarArtistBlocks(topArtists).catch(() => []),
    buildAlbumsBlock({ topArtists, recommendedTracks }).catch(() => []),
  ]);

  const finalGenres = await getUserGenres({ userId, hasHistory, recommendedTracks, albumsForYou });

  const [byGenre, mixesForYou] = await Promise.all([
    buildGenreTrackBlocks(finalGenres).catch(() => []),
    buildMixCardsForUser({ userId, hourBucket: hb, seedTracks, recentTrackIds, finalGenres }).catch(() => []),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    carousel: {
      pageSize: PAGE_SIZE,
      maxForwardPages: MAX_FORWARD_PAGES,
    },
    recommendedTracks,
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
