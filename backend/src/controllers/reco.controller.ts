import { Request, Response } from 'express';
import { createLogger } from '../logger';
import { redisGetSWR } from '../services/cache-swr';
import { TTL_RECO_HOME_SEC, hourBucketUtc, recoHomeCacheKey } from '../services/reco/reco.config';
import {
  buildHomeRecoPayload,
  buildRegeneratedMixes,
  readMixTracks,
  writeMixTracks,
} from '../services/reco/reco.builders';
import { getUserGenres } from '../services/reco/reco.genres';
import { asRecoTrack, takeUniqueTracks } from '../services/reco/reco.tracks';
import { fillMissingTrackMedia } from '../services/track-media.service';
import type { HomeRecoResponse } from '../services/reco/reco.types';
import { AppDataSource } from '../services/dataSource';
import { FavoriteTrack } from '../entities/favorite-track.entity';
import { ListenHistory } from '../entities/listen-history.entity';
import { TrackTag } from '../entities/track-tag.entity';

/** Mix ids look like `<hourBucket>-<n>`. */
const MIX_ID_PATTERN = /^(\d{10})-(\d+)$/;
const MAX_MIX_INDEX = 5;
/** Rows read per table when regenerating mixes from the user's library. */
const SEED_POOL_SIZE = 120;
const SEED_TRACK_LIMIT = 40;
const HISTORY_SAMPLE_SIZE = 30;

/** In-flight home payloads, shared with the SWR cache so concurrent requests
 *  for the same user trigger a single build. */
const homeInflight = new Map<string, Promise<HomeRecoResponse>>();
const homeInflightRefresh = new Map<string, Promise<void>>();

function requireUserId(req: Request): number | null {
  const userId = req.user?.id;
  return userId === undefined ? null : userId;
}

/** GET /api/reco/home — the assembled landing page feed. */
const log = createLogger('reco');

export async function getRecoHome(req: Request, res: Response) {
  const userId = requireUserId(req);
  if (userId === null) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const key = recoHomeCacheKey(userId, hourBucketUtc());
  try {
    const payload = await redisGetSWR<HomeRecoResponse>(
      key,
      TTL_RECO_HOME_SEC,
      undefined,
      () => buildHomeRecoPayload(userId),
      homeInflight,
      homeInflightRefresh,
    );
    return res.json(payload);
  } catch (err) {
    log.error('failed to build home payload', err);
    if (res.headersSent) return res.end();
    // The home screen is built entirely from the upstream, so there is no
    // partial answer to fall back on. An empty, well-formed payload keeps the
    // layout intact and lets the user search or open their library instead of
    // hitting a dead page.
    return res.status(200).json({ tracks: [], albums: [], mixes: [], byGenre: [] });
  }
}

/**
 * POST /api/reco/mixes/regenerate — rebuilds the mix cards from the current
 * library, ignoring the cached home payload.
 */
export async function regenerateMixes(req: Request, res: Response) {
  const userId = requireUserId(req);
  if (userId === null) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const hourBucket = hourBucketUtc();
  try {
    const [favorites, history, tags] = await Promise.all([
      AppDataSource.getRepository(FavoriteTrack).find({
        where: { user: { id: userId } },
        order: { addedAt: 'DESC' },
        take: SEED_POOL_SIZE,
      }),
      AppDataSource.getRepository(ListenHistory).find({
        where: { user: { id: userId } },
        order: { listenedAt: 'DESC' },
        take: SEED_POOL_SIZE,
      }),
      AppDataSource.getRepository(TrackTag).find({
        where: { user: { id: userId } },
        order: { addedAt: 'DESC' },
        take: SEED_POOL_SIZE,
      }),
    ]);

    const usedIds = new Set<string>();
    for (const row of history.slice(0, HISTORY_SAMPLE_SIZE)) {
      const id = (row.trackId ?? '').trim();
      if (id) usedIds.add(id);
    }

    const seedTracks = takeUniqueTracks(
      [...favorites, ...history, ...tags].map(asRecoTrack),
      SEED_TRACK_LIMIT,
    );

    const genres = getUserGenres({
      userId,
      hasHistory: true,
      recommendedTracks: seedTracks,
      albumsForYou: [],
    });
    const mixes = await buildRegeneratedMixes({
      userId,
      hourBucket,
      genres,
      usedIds,
      varietySeed: (userId * 31 + Number(hourBucket)) >>> 0,
    });

    return res.json({ mixes });
  } catch (err) {
    log.error('failed to regenerate mixes', err);
    return res.status(500).json({ message: 'Failed to generate mixes' });
  }
}

/** GET /api/reco/mix/:id — full track list behind one mix card. */
export async function getRecoMix(req: Request, res: Response) {
  const userId = requireUserId(req);
  if (userId === null) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const rawId = String(req.params.id ?? '').trim();
  const match = MIX_ID_PATTERN.exec(rawId);
  if (!match) {
    return res.status(400).json({ message: 'Bad mix id' });
  }

  const hourBucket = match[1]!;
  const n = Number.parseInt(match[2]!, 10);
  if (!Number.isFinite(n) || n < 1 || n > MAX_MIX_INDEX) {
    return res.status(400).json({ message: 'Bad mix id' });
  }

  try {
    const rows = await readMixTracks({ userId, hourBucket, n });
    if (!rows) {
      return res.status(404).json({ message: 'Mix not found' });
    }

    const hydrated = await fillMissingTrackMedia(rows, 12);
    const changed = hydrated.some(
      (row, idx) =>
        row.thumbnailUrl !== rows[idx]?.thumbnailUrl || row.duration !== rows[idx]?.duration,
    );
    if (changed) {
      // Best effort: the mix is still correct if the cache update fails.
      await writeMixTracks({ userId, hourBucket, n, rows: hydrated }).catch(() => undefined);
    }

    return res.json(hydrated);
  } catch (err) {
    log.error('failed to read mix', err);
    return res.status(500).json({ message: 'Mix cache corrupted' });
  }
}
