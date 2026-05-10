import { Request, Response } from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../services/dataSource';
import { TrackTag } from '../entities/track-tag.entity';
import { User } from '../entities/user.entity';
import { FavoriteTrack } from '../entities/favorite-track.entity';
import { PlaylistTrack } from '../entities/playlist-track.entity';
import { Playlist } from '../entities/playlist.entity';
import { Clip } from '../entities/clip.entity';
import { getRedis } from '../redis.client';

function normTag(s: string): string {
  return s.trim().toLowerCase();
}

function cleanTagInput(raw: unknown): { ok: true; display: string; norm: string } | { ok: false; message: string } {
  if (typeof raw !== 'string') {
    return { ok: false, message: 'tag is required' };
  }
  const display = raw.trim();
  if (!display) {
    return { ok: false, message: 'tag is required' };
  }
  if (display.includes('#')) {
    return { ok: false, message: 'tag must not include #' };
  }
  if (display.length > 15) {
    return { ok: false, message: 'tag must be 15 characters or less' };
  }
  return { ok: true, display, norm: normTag(display) };
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

async function trackIsTaggableByUser(userId: number, trackId: string): Promise<boolean> {
  const favRepo = AppDataSource.getRepository(FavoriteTrack);
  const fav = await favRepo.findOne({ where: { user: { id: userId }, trackId } });
  if (fav) {
    return true;
  }

  const playlistTrackRepo = AppDataSource.getRepository(PlaylistTrack);
  const exists = await playlistTrackRepo
    .createQueryBuilder('pt')
    .innerJoin('pt.playlist', 'p')
    .where('p.user_id = :uid', { uid: userId })
    .andWhere('pt.trackId = :tid', { tid: trackId })
    .getExists();

  return exists;
}

async function trackTagNormCount(userId: number, trackId: string): Promise<number> {
  const raw = await AppDataSource.getRepository(TrackTag)
    .createQueryBuilder('t')
    .select('COUNT(DISTINCT LOWER(TRIM(t.tag)))', 'cnt')
    .where('t.user_id = :uid', { uid: userId })
    .andWhere('t.track_id = :tid', { tid: trackId })
    .getRawOne<{ cnt: string }>();
  const n = raw?.cnt ? Number.parseInt(raw.cnt, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

export async function addTag(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { trackId, title, artist, thumbnailUrl, tag } = req.body ?? {};
  if (typeof trackId !== 'string' || !trackId.trim()) {
    return res.status(400).json({ message: 'trackId is required' });
  }
  if (typeof title !== 'string' || typeof artist !== 'string') {
    return res.status(400).json({ message: 'title and artist are required' });
  }

  const cleaned = cleanTagInput(tag);
  if (!cleaned.ok) {
    return res.status(400).json({ message: cleaned.message });
  }

  const tid = trackId.trim();
  const allowed = await trackIsTaggableByUser(userId, tid);
  if (!allowed) {
    return res.status(403).json({ message: 'Tags can be added only to tracks in playlists or favorites' });
  }

  const repo = AppDataSource.getRepository(TrackTag);
  const existingDup = await repo
    .createQueryBuilder('t')
    .where('t.user_id = :uid', { uid: userId })
    .andWhere('t.track_id = :tid', { tid })
    .andWhere('LOWER(TRIM(t.tag)) = :tagNorm', { tagNorm: cleaned.norm })
    .limit(1)
    .getOne();
  if (existingDup) {
    return res.status(409).json({ message: 'Tag already exists for this track' });
  }

  const curCnt = await trackTagNormCount(userId, tid);
  if (curCnt >= 4) {
    return res.status(409).json({ message: 'A track can have up to 4 tags' });
  }

  const row = repo.create({
    user: { id: userId } as User,
    trackId: tid,
    title,
    artist,
    thumbnailUrl: typeof thumbnailUrl === 'string' ? thumbnailUrl : null,
    tag: cleaned.display,
  });
  await repo.save(row);

  return res.status(201).json({
    id: row.id,
    trackId: row.trackId,
    title: row.title,
    artist: row.artist,
    thumbnailUrl: row.thumbnailUrl,
    tag: row.tag,
    addedAt: row.addedAt,
  });
}

export async function listTags(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const repo = AppDataSource.getRepository(TrackTag);
  const rows = await repo.find({
    where: { user: { id: userId } },
    order: { addedAt: 'DESC' },
  });

  return res.json(
    rows.map((r) => ({
      id: r.id,
      trackId: r.trackId,
      title: r.title,
      artist: r.artist,
      thumbnailUrl: r.thumbnailUrl,
      tag: r.tag,
      addedAt: r.addedAt,
    })),
  );
}

export async function listDistinctTags(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const sortParam = (req.query as any)?.sort;
  const sort = typeof sortParam === 'string' ? sortParam : 'createdAt';

  const qb = AppDataSource.getRepository(TrackTag)
    .createQueryBuilder('t')
    .select('MIN(t.tag)', 'tag')
    .addSelect('MIN(t.added_at)', 'createdAt')
    .addSelect('COUNT(DISTINCT t.track_id)', 'usageCount')
    .where('t.user_id = :uid', { uid: userId })
    .groupBy('LOWER(TRIM(t.tag))');

  if (sort === 'alpha') {
    qb.orderBy('MIN(LOWER(TRIM(t.tag)))', 'ASC');
  } else if (sort === 'createdAt') {
    qb.orderBy('MIN(t.added_at)', 'DESC');
  } else {
    return res.status(400).json({ message: 'Invalid sort' });
  }

  const raw = await qb.getRawMany<{ tag: string; createdAt: string; usageCount: string }>();
  return res.json(
    raw.map((r) => ({
      tag: r.tag,
      createdAt: r.createdAt,
      usageCount: Number.parseInt(r.usageCount, 10) || 0,
    })),
  );
}

export async function listTrackTags(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const rawTrackId = req.params.trackId;
  const trackId =
    typeof rawTrackId === 'string'
      ? decodeURIComponent(rawTrackId).trim()
      : Array.isArray(rawTrackId)
        ? decodeURIComponent(rawTrackId[0] ?? '').trim()
        : '';
  if (!trackId) {
    return res.status(400).json({ message: 'trackId is required' });
  }

  const rows = await AppDataSource.getRepository(TrackTag).find({
    where: { user: { id: userId }, trackId },
    order: { addedAt: 'ASC' },
  });

  const seen = new Set<string>();
  const out: { tag: string; addedAt: Date }[] = [];
  for (const r of rows) {
    const n = normTag(r.tag);
    if (seen.has(n)) {
      continue;
    }
    seen.add(n);
    out.push({ tag: r.tag, addedAt: r.addedAt });
  }
  return res.json(out);
}

export async function removeTrackTag(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const rawTrackId = req.params.trackId;
  const rawTag = req.params.tag;
  const trackId =
    typeof rawTrackId === 'string'
      ? decodeURIComponent(rawTrackId).trim()
      : Array.isArray(rawTrackId)
        ? decodeURIComponent(rawTrackId[0] ?? '').trim()
        : '';
  const tag =
    typeof rawTag === 'string'
      ? decodeURIComponent(rawTag)
      : Array.isArray(rawTag)
        ? decodeURIComponent(rawTag[0] ?? '')
        : '';
  if (!trackId) {
    return res.status(400).json({ message: 'trackId is required' });
  }

  const cleaned = cleanTagInput(tag);
  if (!cleaned.ok) {
    return res.status(400).json({ message: cleaned.message });
  }

  const repo = AppDataSource.getRepository(TrackTag);
  await repo
    .createQueryBuilder()
    .delete()
    .where('user_id = :uid', { uid: userId })
    .andWhere('track_id = :tid', { tid: trackId })
    .andWhere('LOWER(TRIM(tag)) = :tagNorm', { tagNorm: cleaned.norm })
    .execute();

  return res.status(204).send();
}

export async function listMoods(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const raw = await AppDataSource.getRepository(TrackTag)
    .createQueryBuilder('t')
    .select('MIN(t.tag)', 'tag')
    .where('t.user_id = :uid', { uid: userId })
    .groupBy('LOWER(TRIM(t.tag))')
    .orderBy('MIN(LOWER(TRIM(t.tag)))', 'ASC')
    .getRawMany<{ tag: string }>();

  return res.json(raw.map((r) => r.tag));
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const MOOD_CACHE_TTL_SEC = envInt('REDIS_TTL_MOOD_SEC', 1200);

async function resolveDurationsByTrackId(userId: number, trackIds: string[]): Promise<Map<string, number>> {
  const normalized = [...new Set(trackIds.map((id) => id.trim()).filter((id) => !!id))];
  if (normalized.length === 0) {
    return new Map<string, number>();
  }

  const durationMap = new Map<string, number>();

  const favorites = await AppDataSource.getRepository(FavoriteTrack)
    .createQueryBuilder('f')
    .select('f.track_id', 'trackId')
    .addSelect('MAX(f.duration)', 'duration')
    .where('f.user_id = :uid', { uid: userId })
    .andWhere('f.track_id IN (:...trackIds)', { trackIds: normalized })
    .groupBy('f.track_id')
    .getRawMany<{ trackId: string; duration: string | number | null }>();

  for (const row of favorites) {
    const duration = Number(row.duration);
    if (Number.isFinite(duration) && duration > 0) {
      durationMap.set(row.trackId, Math.floor(duration));
    }
  }

  const playlistRows = await AppDataSource.getRepository(PlaylistTrack)
    .createQueryBuilder('pt')
    .innerJoin(Playlist, 'p', 'p.id = pt.playlist_id')
    .select('pt.track_id', 'trackId')
    .addSelect('MAX(pt.duration)', 'duration')
    .where('p.user_id = :uid', { uid: userId })
    .andWhere('pt.track_id IN (:...trackIds)', { trackIds: normalized })
    .groupBy('pt.track_id')
    .getRawMany<{ trackId: string; duration: string | number | null }>();

  for (const row of playlistRows) {
    const duration = Number(row.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      continue;
    }
    const prev = durationMap.get(row.trackId) ?? 0;
    if (duration > prev) {
      durationMap.set(row.trackId, Math.floor(duration));
    }
  }

  return durationMap;
}

export async function moodPlaylist(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const tagParam = req.params.tag;
  const tag =
    typeof tagParam === 'string'
      ? decodeURIComponent(tagParam)
      : Array.isArray(tagParam)
        ? decodeURIComponent(tagParam[0] ?? '')
        : '';

  if (!tag.trim()) {
    return res.status(400).json({ message: 'tag is required' });
  }

  const cleaned = cleanTagInput(tag);
  if (!cleaned.ok) {
    return res.status(400).json({ message: cleaned.message });
  }

  const tagNorm = cleaned.norm;
  const cacheKey = `mood:v2:${userId}:${tagNorm}`;

  try {
    const cached = await getRedis().get(cacheKey);
    if (cached) {
      const payload = JSON.parse(cached) as { playlistName: string; tracks: unknown };
      return res.json({ ...payload, fromCache: true });
    }
  } catch {
    // fall through
  }

  const repo = AppDataSource.getRepository(TrackTag);
  const rows = await repo
    .createQueryBuilder('t')
    .where('t.user_id = :uid', { uid: userId })
    .andWhere('LOWER(TRIM(t.tag)) = :tagNorm', { tagNorm })
    .getMany();

  const seen = new Set<string>();
  const unique: { trackId: string; title: string; artist: string; thumbnailUrl: string | null }[] = [];
  for (const r of rows) {
    if (seen.has(r.trackId)) {
      continue;
    }
    seen.add(r.trackId);
    unique.push({
      trackId: r.trackId,
      title: r.title,
      artist: r.artist,
      thumbnailUrl: r.thumbnailUrl,
    });
  }

  shuffleInPlace(unique);
  const baseTracks = unique.slice(0, 30);
  const durations = await resolveDurationsByTrackId(
    userId,
    baseTracks.map((t) => t.trackId),
  );
  const tracks = baseTracks.map((t) => ({
    trackId: t.trackId,
    title: t.title,
    artist: t.artist,
    thumbnailUrl: t.thumbnailUrl,
    duration: durations.get(t.trackId) ?? null,
  }));

  const body = {
    playlistName: `Playlist: ${cleaned.display}`,
    tracks,
  };

  try {
    await getRedis().set(cacheKey, JSON.stringify(body), 'EX', MOOD_CACHE_TTL_SEC);
  } catch {
    // ignore
  }

  return res.json({ ...body, fromCache: false });
}

export async function tagsPlaylist(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const rawTags = (req.query as any)?.tags;
  const tags: string[] = Array.isArray(rawTags) ? rawTags : typeof rawTags === 'string' ? [rawTags] : [];
  if (tags.length === 0) {
    return res.status(400).json({ message: 'tags is required' });
  }
  if (tags.length > 4) {
    return res.status(400).json({ message: 'Up to 4 tags are allowed' });
  }

  const cleanedArr = tags.map((t) => cleanTagInput(t));
  const bad = cleanedArr.find((c) => !c.ok) as { ok: false; message: string } | undefined;
  if (bad) {
    return res.status(400).json({ message: bad.message });
  }
  const good = cleanedArr as Array<{ ok: true; display: string; norm: string }>;
  const norms = [...new Set(good.map((g) => g.norm))];
  if (norms.length !== good.length) {
    return res.status(400).json({ message: 'Duplicate tags are not allowed' });
  }

  const rows = await AppDataSource.getRepository(TrackTag)
    .createQueryBuilder('t')
    .select('t.track_id', 'trackId')
    .addSelect('MIN(t.title)', 'title')
    .addSelect('MIN(t.artist)', 'artist')
    .addSelect('MIN(t.thumbnail_url)', 'thumbnailUrl')
    .addSelect('MIN(t.added_at)', 'addedAt')
    .where('t.user_id = :uid', { uid: userId })
    .andWhere('LOWER(TRIM(t.tag)) IN (:...norms)', { norms })
    .groupBy('t.track_id')
    .having('COUNT(DISTINCT LOWER(TRIM(t.tag))) = :n', { n: norms.length })
    .getRawMany<{ trackId: string; title: string; artist: string; thumbnailUrl: string | null; addedAt: Date | null }>();

  shuffleInPlace(rows);
  const baseTracks = rows.slice(0, 50);
  const durations = await resolveDurationsByTrackId(
    userId,
    baseTracks.map((r) => r.trackId),
  );

  const clipShortCodes = baseTracks
    .filter((r) => r.trackId.startsWith('clip:'))
    .map((r) => r.trackId.slice(5));
  const clipMap = new Map<string, { startTime: number; endTime: number }>();
  if (clipShortCodes.length > 0) {
    const clipRepo = AppDataSource.getRepository(Clip);
    const clips = await clipRepo.find({
      where: { shortCode: In(clipShortCodes) },
    });
    for (const c of clips) {
      clipMap.set(c.shortCode, { startTime: c.startTime, endTime: c.endTime });
    }
  }

  const tracks = baseTracks.map((r) => {
    const base: any = {
      trackId: r.trackId,
      title: r.title,
      artist: r.artist,
      thumbnailUrl: r.thumbnailUrl,
      duration: durations.get(r.trackId) ?? null,
    };
    if (r.addedAt) {
      base.addedAt = r.addedAt;
    }
    if (r.trackId.startsWith('clip:')) {
      const sc = r.trackId.slice(5);
      const clip = clipMap.get(sc);
      if (clip) {
        base.startTime = clip.startTime;
        base.endTime = clip.endTime;
      }
    }
    return base;
  });

  const playlistName = `Playlist: ${good.map((g) => g.display).join(' + ')}`;
  return res.json({ playlistName, tracks });
}
