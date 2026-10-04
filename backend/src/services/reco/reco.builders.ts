import { AppDataSource } from "../dataSource";
import { FavoriteTrack } from "../../entities/favorite-track.entity";
import { ListenHistory } from "../../entities/listen-history.entity";
import { PlaylistTrack } from "../../entities/playlist-track.entity";
import { TrackTag } from "../../entities/track-tag.entity";
import { getRedis } from "../redis";
import { ytmusicService } from "../ytmusic.service";
import {
  MAX_FORWARD_PAGES,
  MAX_GENRE_BLOCKS,
  MAX_RECO_SEEDS,
  MAX_TOP_ARTISTS,
  MIN_MIX_TRACKS,
  MIN_RADIO_TRACKS,
  PAGE_SIZE,
  PAGE_TOTAL,
  TTL_RECO_MIX_SEC,
  TTL_RECO_SIMILAR_SEC,
  getPersonalizedFallbackGenres,
  hourBucketUtc,
  mixCacheKey,
  similarCacheKey,
} from "./reco.config";
import {
  filterGenrePool,
  getUserGenres,
  tracksMatchingGenre,
} from "./reco.genres";
import {
  fillMissingTrackMedia,
  isYoutubeVideoId,
  youtubeThumbnailFallbackUrl,
} from "../track-media.service";
import {
  asRecoTrack,
  capArtists,
  isLikelyCompilation,
  pickTopArtists,
  takeUniqueTracks,
  takeUniqueTracksShuffled,
} from "./reco.tracks";
import type {
  GenreBlock,
  HomeRecoResponse,
  MixCard,
  MixTrackRow,
  RecoAlbum,
  RecoArtist,
  RecoTrack,
  SimilarBlock,
} from "./reco.types";

/** Rows read per user table when assembling the seed pool. */
const SEED_POOL_SIZE = 120;
/** Cap on seed tracks before they are narrowed down. */
const SEED_TRACK_LIMIT = 40;
/** How many of the most recent listens count as "already heard". */
const HISTORY_SAMPLE_SIZE = 30;
/** Preview thumbnails rendered on a mix card. */
const MIX_PREVIEW_THUMBS = 4;
/** Radio entries requested per seed track. */
const RADIO_FETCH_SIZE = 60;
/** How many artists a mix subtitle lists. */
const MIX_SUBTITLE_ARTISTS = 4;
/** Broad queries used to fill the feed for a user with no history. */
const POPULAR_FALLBACK_QUERIES = ["top songs 2026", "popular songs"];

type SeedSource = {
  history: ListenHistory[];
  favorites: FavoriteTrack[];
  playlist: PlaylistTrack[];
  tags: TrackTag[];
};

/**
 * Reads everything that describes the user's taste. The four tables are
 * independent, so they are fetched concurrently.
 */
async function loadUserSeeds(userId: number): Promise<SeedSource> {
  const [history, favorites, playlist, tags] = await Promise.all([
    AppDataSource.getRepository(ListenHistory).find({
      where: { user: { id: userId } },
      order: { listenedAt: "DESC" },
      take: SEED_POOL_SIZE,
    }),
    AppDataSource.getRepository(FavoriteTrack).find({
      where: { user: { id: userId } },
      order: { addedAt: "DESC" },
      take: SEED_POOL_SIZE,
    }),
    AppDataSource.getRepository(PlaylistTrack)
      .createQueryBuilder("pt")
      .innerJoin("pt.playlist", "p")
      .where("p.user_id = :uid", { uid: userId })
      .orderBy("pt.addedAt", "DESC")
      .take(SEED_POOL_SIZE)
      .getMany(),
    AppDataSource.getRepository(TrackTag).find({
      where: { user: { id: userId } },
      order: { addedAt: "DESC" },
      take: SEED_POOL_SIZE,
    }),
  ]);

  return { history, favorites, playlist, tags };
}

function toRecoTracks(source: SeedSource): RecoTrack[] {
  return [
    ...source.history.map(asRecoTrack),
    ...source.favorites.map(asRecoTrack),
    ...source.playlist.map(asRecoTrack),
    ...source.tags.map(asRecoTrack),
  ];
}

/** Builds a mix card from its tracks: subtitle, cover and preview strip. */
function buildMixCard(
  id: string,
  title: string,
  tracks: readonly MixTrackRow[],
): MixCard {
  const thumbs = tracks
    .map((row) => row.thumbnailUrl)
    .filter((url): url is string => !!url)
    .slice(0, MIX_PREVIEW_THUMBS);
  const artists = pickTopArtists(tracks, MIX_SUBTITLE_ARTISTS);

  return {
    id,
    title,
    subtitle: artists.join(", "),
    thumbnailUrl: thumbs[0] ?? null,
    artists,
    previewThumbs: thumbs,
  };
}

/**
 * Card-only fallback used when mix generation produced nothing (for example all
 * upstream searches failed). Reuses whatever the genre blocks already found
 * instead of issuing new requests.
 */
function buildMixCardsFromGenreBlocks(
  topArtists: string[],
  genreBlocks: readonly GenreBlock[],
): MixCard[] {
  const cards: MixCard[] = [];
  const groups = [
    topArtists.slice(0, 3),
    topArtists.slice(1, 4),
    topArtists.slice(2, 5),
  ];

  for (const [index, group] of groups.entries()) {
    const artists = group.filter((name) => name.trim().length > 0);
    if (artists.length < MIN_MIX_TRACKS) continue;

    const source =
      genreBlocks[index % Math.max(genreBlocks.length, 1)]?.tracks ?? [];
    cards.push({
      id: `mix-${index + 1}`,
      title: `Mix for you #${index + 1}`,
      subtitle: artists.join(", "),
      thumbnailUrl: source[0]?.thumbnailUrl ?? null,
      artists,
    });
  }

  return cards;
}

/**
 * "Similar to your artists": for each seed artist take the related acts YouTube
 * Music reports, dropping browse ids an earlier seed already claimed.
 *
 * Note on determinism: seeds run concurrently and share one `seen` set, so which
 * seed "wins" a given artist depends on network timing. That only affects which
 * card an artist lands on, never whether it appears at all.
 */
async function buildSimilarArtistBlocks(
  artists: string[],
): Promise<SimilarBlock[]> {
  const seeds = artists
    .slice(0, MAX_GENRE_BLOCKS)
    .filter((artist) => artist.trim().length > 0);
  if (seeds.length === 0) return [];

  const redis = getRedis();
  const seenBrowseIds = new Set<string>();

  const claim = (items: readonly RecoArtist[]): RecoArtist[] => {
    const fresh = items.filter(
      (item) => item.browseId && !seenBrowseIds.has(item.browseId),
    );
    for (const item of fresh) seenBrowseIds.add(item.browseId);
    return fresh;
  };

  const blocks = await Promise.all(
    seeds.map(async (seed): Promise<SimilarBlock | null> => {
      const cacheKey = similarCacheKey(seed);

      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const block = JSON.parse(cached) as SimilarBlock | null;
          if (block?.items?.length) {
            const items = claim(block.items);
            return items.length > 0 ? { ...block, items } : null;
          }
        }
      } catch {
        // An unreadable or corrupt cache entry just means we refetch.
      }

      try {
        const [hit] = await ytmusicService.searchArtists(seed);
        const browseId = hit?.browseId;
        if (!browseId) return null;

        const detail = await ytmusicService.getArtist(browseId);
        const items = claim(
          (detail?.relatedArtists ?? [])
            .filter((row) => row.browseId && row.name)
            .slice(0, PAGE_TOTAL)
            .map((row) => ({
              browseId: row.browseId,
              name: row.name,
              thumbnailUrl: row.thumbnailUrl,
              subscribers: row.subscribers,
            })),
        );
        if (items.length === 0) return null;

        const block = { seedArtist: seed, items };
        redis
          .set(cacheKey, JSON.stringify(block), "EX", TTL_RECO_SIMILAR_SEC)
          .catch(() => undefined);
        return block;
      } catch {
        return null;
      }
    }),
  );

  return blocks.filter((block): block is SimilarBlock => block !== null);
}

/**
 * Album covers for the home carousel, at most one row per artist so the strip
 * does not turn into a single-artist wall. Falls back to a genre lookup when
 * the artist queries return nothing usable.
 */
async function buildAlbumsBlock(params: {
  topArtists: string[];
  userId: number;
}): Promise<RecoAlbum[]> {
  const { topArtists, userId } = params;
  const albums: RecoAlbum[] = [];
  const seenArtists = new Set<string>();

  const pushUnique = (row: {
    browseId: string;
    title: string;
    artist: string;
    thumbnailUrl: string;
    year: string;
  }): void => {
    if (!row.browseId || !row.title || albums.length >= PAGE_TOTAL) return;
    if (albums.some((album) => album.browseId === row.browseId)) return;
    const artist = (row.artist ?? "").trim().toLowerCase();
    if (!artist || seenArtists.has(artist)) return;
    seenArtists.add(artist);
    albums.push({
      browseId: row.browseId,
      title: row.title,
      artist: row.artist,
      thumbnailUrl: row.thumbnailUrl,
      year: row.year,
    });
  };

  const collectFromBatch = (
    batch: Awaited<ReturnType<typeof ytmusicService.searchAlbumsBatch>>,
  ): void => {
    for (const pack of batch) {
      for (const row of (pack.albums ?? []).slice(0, 3)) pushUnique(row);
      if (albums.length >= PAGE_TOTAL) return;
    }
  };

  collectFromBatch(
    await ytmusicService.searchAlbumsBatch(topArtists.slice(0, 8)),
  );
  if (albums.length > 0) return albums;

  try {
    const genres = getPersonalizedFallbackGenres(userId);
    const genre =
      genres[(userId * 7 + new Date().getUTCHours()) % genres.length] ?? "pop";
    collectFromBatch(await ytmusicService.searchAlbumsBatch([genre]));
  } catch {
    // Leave the block empty rather than failing the whole page.
  }

  return albums;
}

/**
 * One row of tracks per genre. The user's own matching tracks lead the block so
 * it opens with something familiar, then the genre is topped up from a search.
 * Tracks an earlier block already used, and tracks that clearly belong to a
 * different genre, are excluded.
 */
async function buildGenreTrackBlocks(params: {
  genres: string[];
  varietySeed: number;
  recommendedTracks?: readonly RecoTrack[];
  usedTrackIds?: ReadonlySet<string>;
  usedArtistNames?: ReadonlySet<string>;
}): Promise<GenreBlock[]> {
  const {
    genres,
    varietySeed,
    recommendedTracks,
    usedTrackIds,
    usedArtistNames,
  } = params;

  const blockUsedTrackIds = new Set(usedTrackIds);
  const blockUsedArtists = new Set(usedArtistNames);
  const blocks: GenreBlock[] = [];

  for (const [index, genre] of genres.slice(0, MAX_GENRE_BLOCKS).entries()) {
    const recos = recommendedTracks
      ? tracksMatchingGenre(recommendedTracks, genre)
      : [];

    try {
      const songs = await ytmusicService.searchSongs(`${genre} music`);
      const pool = filterGenrePool((songs ?? []).map(asRecoTrack), genre)
        .filter((track) => !isLikelyCompilation(track))
        .filter(
          (track) => !recos.some((reco) => reco.trackId === track.trackId),
        );

      const block = takeUniqueTracksShuffled(
        [...recos, ...pool].filter(
          (track) =>
            !blockUsedTrackIds.has(track.trackId) &&
            !blockUsedArtists.has(track.artist.trim().toLowerCase()),
        ),
        PAGE_TOTAL,
        varietySeed + index,
      );

      if (block.length > 0) {
        for (const track of block) {
          blockUsedTrackIds.add(track.trackId);
          blockUsedArtists.add(track.artist.trim().toLowerCase());
        }
        blocks.push({ genre, tracks: block });
      }
    } catch {
      // A failed genre search must not remove the other blocks.
    }
  }

  return blocks;
}

/**
 * YouTube Music radio seeded from the user's most recent tracks — the main
 * source of the "recommended for you" strip.
 */
async function buildRadioRecommendations(params: {
  seedTracks: readonly RecoTrack[];
  excludeTrackIds: ReadonlySet<string>;
  totalLimit: number;
}): Promise<RecoTrack[]> {
  const seedIds = takeUniqueTracks(params.seedTracks, Number.MAX_SAFE_INTEGER)
    .map((track) => track.trackId.trim())
    .filter((id) => id.length > 0)
    .slice(0, MAX_RECO_SEEDS);

  if (seedIds.length === 0) return [];

  const batch = await ytmusicService.getRadioBatch(seedIds, RADIO_FETCH_SIZE);

  const candidates = takeUniqueTracks(
    batch.flatMap((item) =>
      item.error
        ? []
        : item.tracks.map((track) => ({
            trackId: track.trackId,
            title: track.title,
            artist: track.artist,
            thumbnailUrl: track.thumbnailUrl || null,
            duration: Number.isFinite(track.duration) ? track.duration : null,
          })),
    ),
    Number.MAX_SAFE_INTEGER,
  ).filter(
    (track) =>
      !params.excludeTrackIds.has(track.trackId) && !isLikelyCompilation(track),
  );

  return capArtists(candidates, 2, params.totalLimit);
}

/**
 * Cold-start filler: broad "popular" queries used when the radio feed comes
 * back nearly empty, e.g. for a brand-new account.
 */
async function getPopularFallbackTracks(
  varietySeed: number,
): Promise<RecoTrack[]> {
  const results = await Promise.all(
    POPULAR_FALLBACK_QUERIES.map(async (query) => {
      try {
        const songs = await ytmusicService.searchSongs(query);
        return (songs ?? [])
          .map(asRecoTrack)
          .filter((track) => !isLikelyCompilation(track));
      } catch {
        return [] as RecoTrack[];
      }
    }),
  );

  return takeUniqueTracksShuffled(results.flat(), PAGE_TOTAL, varietySeed);
}

/**
 * Generates the "mixes for you" cards and persists each mix's track list so
 * `/reco/mix/:id` can serve it later without rebuilding.
 */
export async function buildRegeneratedMixes(params: {
  userId: number;
  hourBucket: string;
  genres: string[];
  usedIds: Set<string>;
  varietySeed?: number;
}): Promise<MixCard[]> {
  const { userId, hourBucket, genres, usedIds, varietySeed = 0 } = params;

  // Pad to three mixes even when fewer genres were detected, reusing genres so
  // the cards stay varied.
  const mixGenres = Array.from({ length: MAX_GENRE_BLOCKS }, (_, index) =>
    genres.length > 0
      ? genres[index % genres.length]!
      : getPersonalizedFallbackGenres(userId)[index % MAX_GENRE_BLOCKS]!,
  );

  const perGenre = await Promise.all(
    mixGenres.map(async (genre) => {
      try {
        return await ytmusicService.searchSongs(`${genre} music`);
      } catch {
        return [];
      }
    }),
  );

  const allTracks = takeUniqueTracks(
    perGenre
      .flat()
      .map(asRecoTrack)
      .filter((track) => !isLikelyCompilation(track)),
    Number.MAX_SAFE_INTEGER,
  );

  const seen = new Set<string>(usedIds);
  const cards: MixCard[] = [];

  for (const [index, songs] of perGenre.entries()) {
    const genreTracks = songs
      .map(asRecoTrack)
      .filter((track) => !isLikelyCompilation(track));
    let mixTracks = takeUniqueTracksShuffled(
      genreTracks.filter((track) => !seen.has(track.trackId)),
      PAGE_TOTAL,
      varietySeed + index,
    );

    // Thin genre: top the mix up from the other genres so the card is not sparse.
    if (mixTracks.length < PAGE_SIZE) {
      const extras = allTracks.filter((track) => !seen.has(track.trackId));
      mixTracks = takeUniqueTracksShuffled(
        [...mixTracks, ...extras],
        PAGE_TOTAL,
        varietySeed + index * 7,
      );
    }
    if (mixTracks.length < MIN_MIX_TRACKS) continue;

    for (const track of mixTracks) {
      usedIds.add(track.trackId);
      seen.add(track.trackId);
    }

    const n = index + 1;
    const rows: MixTrackRow[] = mixTracks.map((track, idx) => ({
      id: idx + 1,
      trackId: track.trackId,
      title: track.title,
      artist: track.artist,
      thumbnailUrl:
        track.thumbnailUrl ||
        (isYoutubeVideoId(track.trackId)
          ? youtubeThumbnailFallbackUrl(track.trackId)
          : null),
      duration: track.duration ?? null,
    }));

    // Fire-and-forget: a cache write failure must not fail the request.
    getRedis()
      .set(
        mixCacheKey({ userId, hourBucket, n }),
        JSON.stringify(rows),
        "EX",
        TTL_RECO_MIX_SEC,
      )
      .catch(() => undefined);

    cards.push(buildMixCard(`${hourBucket}-${n}`, `Mix #${n}`, rows));
  }

  return cards;
}

/**
 * Assembles the whole home payload: recommended tracks, albums, mixes,
 * similar artists and per-genre rows.
 */
export async function buildHomeRecoPayload(
  userId: number,
): Promise<HomeRecoResponse> {
  const hourBucket = hourBucketUtc();
  const seeds = await loadUserSeeds(userId);
  const pool = toRecoTracks(seeds);

  const recentTrackIds = new Set<string>();
  for (const row of seeds.history.slice(0, HISTORY_SAMPLE_SIZE)) {
    const id = (row.trackId ?? "").trim();
    if (id) recentTrackIds.add(id);
  }

  const seedTracks = takeUniqueTracks(pool, SEED_TRACK_LIMIT);
  const topArtists = pickTopArtists(seedTracks, MAX_TOP_ARTISTS);
  const varietySeed = (userId * 31 + Number(hourBucket)) >>> 0;
  const hasHistory = pool.length > 0;

  const radioPromise =
    seedTracks.length > 0
      ? buildRadioRecommendations({
          seedTracks,
          excludeTrackIds: recentTrackIds,
          totalLimit: PAGE_TOTAL,
        })
      : Promise.resolve<RecoTrack[]>([]);

  const [radioResult, similarTo, albumsForYou, popularTracks] =
    await Promise.all([
      radioPromise,
      buildSimilarArtistBlocks(topArtists).catch(() => [] as SimilarBlock[]),
      buildAlbumsBlock({ topArtists, userId }).catch(() => [] as RecoAlbum[]),
      getPopularFallbackTracks(varietySeed).catch(() => [] as RecoTrack[]),
    ]);

  let recommendedTracks = radioResult;
  if (recommendedTracks.length < MIN_RADIO_TRACKS) {
    recommendedTracks = takeUniqueTracks(
      [
        ...recommendedTracks,
        ...takeUniqueTracks(pool, PAGE_TOTAL),
        ...popularTracks,
      ],
      PAGE_TOTAL,
    );
  }

  recommendedTracks = await fillMissingTrackMedia(
    recommendedTracks,
    PAGE_TOTAL,
  );

  const finalGenres = getUserGenres({
    userId,
    hasHistory,
    recommendedTracks,
    albumsForYou,
  });
  const recoTrackIds = new Set(recommendedTracks.map((track) => track.trackId));
  const recoArtistNames = new Set(
    recommendedTracks.map((track) => track.artist.trim().toLowerCase()),
  );

  const [byGenre, mixes] = await Promise.all([
    buildGenreTrackBlocks({
      genres: finalGenres,
      varietySeed,
      recommendedTracks,
      usedTrackIds: recoTrackIds,
      usedArtistNames: recoArtistNames,
    }).catch(() => [] as GenreBlock[]),
    buildRegeneratedMixes({
      userId,
      hourBucket,
      genres: finalGenres,
      usedIds: recentTrackIds,
      varietySeed,
    }).catch(() => [] as MixCard[]),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    carousel: { pageSize: PAGE_SIZE, maxForwardPages: MAX_FORWARD_PAGES },
    recommendedTracks,
    albumsForYou,
    mixesForYou:
      mixes.length > 0
        ? mixes
        : buildMixCardsFromGenreBlocks(topArtists, byGenre),
    similarTo,
    byGenre,
  };
}

/** Reads a mix's track list straight from the cache, or `null` when absent. */
export async function readMixTracks(params: {
  userId: number;
  hourBucket: string;
  n: number;
}): Promise<MixTrackRow[] | null> {
  const raw = await getRedis().get(mixCacheKey(params));
  if (!raw) return null;
  return JSON.parse(raw) as MixTrackRow[];
}

/** Persists a mix whose media metadata was filled in on the way out. */
export async function writeMixTracks(params: {
  userId: number;
  hourBucket: string;
  n: number;
  rows: MixTrackRow[];
}): Promise<void> {
  await getRedis().set(
    mixCacheKey(params),
    JSON.stringify(params.rows),
    "EX",
    TTL_RECO_MIX_SEC,
  );
}
