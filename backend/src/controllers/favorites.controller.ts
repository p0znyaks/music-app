import { Request, Response } from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../services/dataSource';
import { FavoriteTrack } from '../entities/favorite-track.entity';
import { PlaylistTrack } from '../entities/playlist-track.entity';
import { Playlist } from '../entities/playlist.entity';
import { TrackTag } from '../entities/track-tag.entity';
import { User } from '../entities/user.entity';
import { Clip } from '../entities/clip.entity';

function paramTrackId(raw: string | string[] | undefined): string {
  if (raw === undefined) {
    return '';
  }
  const s = Array.isArray(raw) ? raw[0] : raw;
  return typeof s === 'string' ? decodeURIComponent(s) : '';
}

export async function addFavorite(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { trackId, title, artist, thumbnailUrl, duration } = req.body ?? {};
  if (typeof trackId !== 'string' || !trackId.trim()) {
    return res.status(400).json({ message: 'trackId is required' });
  }
  if (typeof title !== 'string' || typeof artist !== 'string') {
    return res.status(400).json({ message: 'title and artist are required' });
  }

  const repo = AppDataSource.getRepository(FavoriteTrack);
  const existing = await repo.findOne({
    where: { user: { id: userId }, trackId: trackId.trim() },
  });
  if (existing) {
    return res.status(409).json({ message: 'Already in favorites' });
  }

  const row = repo.create({
    user: { id: userId } as User,
    trackId: trackId.trim(),
    title,
    artist,
    thumbnailUrl: typeof thumbnailUrl === 'string' ? thumbnailUrl : null,
    duration: typeof duration === 'number' && Number.isFinite(duration) ? Math.floor(duration) : null,
  });
  await repo.save(row);

  return res.status(201).json({
    id: row.id,
    trackId: row.trackId,
    title: row.title,
    artist: row.artist,
    thumbnailUrl: row.thumbnailUrl,
    duration: row.duration,
    addedAt: row.addedAt,
  });
}

export async function removeFavorite(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const trackId = paramTrackId(req.params.trackId);
  if (!trackId) {
    return res.status(400).json({ message: 'trackId is required' });
  }

  const force = (req.query as any)?.force === '1';

  const repo = AppDataSource.getRepository(FavoriteTrack);
  const row = await repo.findOne({
    where: { user: { id: userId }, trackId },
  });
  if (!row) {
    return res.status(404).json({ message: 'Favorite not found' });
  }

  const tagRepo = AppDataSource.getRepository(TrackTag);
  const tagCount = await tagRepo.count({ where: { user: { id: userId }, trackId } });

  const playlistTrackRepo = AppDataSource.getRepository(PlaylistTrack);
  const inAnyPlaylist = await playlistTrackRepo
    .createQueryBuilder('pt')
    .innerJoin('pt.playlist', 'p')
    .where('p.user_id = :uid', { uid: userId })
    .andWhere('pt.trackId = :tid', { tid: trackId })
    .getExists();

  const willHaveNoSources = !inAnyPlaylist;
  if (!force && tagCount > 0 && willHaveNoSources) {
    return res.status(409).json({
      message: 'Track has tags. Confirmation required.',
      requiresConfirm: true,
      hasTags: true,
      tagCount,
    });
  }

  await repo.remove(row);

  if (willHaveNoSources) {
    await tagRepo
      .createQueryBuilder()
      .delete()
      .where('user_id = :uid', { uid: userId })
      .andWhere('track_id = :tid', { tid: trackId })
      .execute();
  }

  return res.status(204).send();
}

export async function listFavorites(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const repo = AppDataSource.getRepository(FavoriteTrack);
  const rows = await repo.find({
    where: { user: { id: userId } },
    order: { addedAt: 'DESC' },
  });

  const clipShortCodes = rows
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

  return res.json(
    rows.map((r) => {
      const base: any = {
        id: r.id,
        trackId: r.trackId,
        title: r.title,
        artist: r.artist,
        thumbnailUrl: r.thumbnailUrl,
        duration: r.duration,
        addedAt: r.addedAt,
      };
      if (r.trackId.startsWith('clip:')) {
        const sc = r.trackId.slice(5);
        const clip = clipMap.get(sc);
        if (clip) {
          base.startTime = clip.startTime;
          base.endTime = clip.endTime;
        }
      }
      return base;
    }),
  );
}
