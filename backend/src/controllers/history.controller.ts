import { Request, Response } from 'express';
import { AppDataSource } from '../services/dataSource';
import { ListenHistory } from '../entities/listen-history.entity';
import { User } from '../entities/user.entity';

export async function addHistory(req: Request, res: Response) {
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

  const repo = AppDataSource.getRepository(ListenHistory);
  const row = repo.create({
    user: { id: userId } as User,
    trackId: trackId.trim(),
    title,
    artist,
    thumbnailUrl: typeof thumbnailUrl === 'string' ? thumbnailUrl : null,
    duration: typeof duration === 'number' ? duration : null,
  });
  await repo.save(row);

  return res.status(201).json({
    id: row.id,
    trackId: row.trackId,
    title: row.title,
    artist: row.artist,
    thumbnailUrl: row.thumbnailUrl,
    duration: row.duration,
    listenedAt: row.listenedAt,
  });
}

export async function listHistory(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const repo = AppDataSource.getRepository(ListenHistory);
  const rows = await repo.find({
    where: { user: { id: userId } },
    order: { listenedAt: 'DESC' },
    take: 50,
  });

  return res.json(
    rows.map((r) => ({
      id: r.id,
      trackId: r.trackId,
      title: r.title,
      artist: r.artist,
      thumbnailUrl: r.thumbnailUrl,
      duration: r.duration,
      listenedAt: r.listenedAt,
    })),
  );
}