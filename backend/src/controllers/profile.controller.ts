import { Request, Response } from 'express';
import { AppDataSource } from '../services/dataSource';
import { User } from '../entities/user.entity';
import { ListenHistory } from '../entities/listen-history.entity';
import { Playlist } from '../entities/playlist.entity';
import { FavoriteTrack } from '../entities/favorite-track.entity';

/** GET /api/profile — the signed-in user's own account summary. */
export async function getProfile(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) return res.status(401).json({ message: 'Unauthorized' });

  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: userId },
    relations: ['role'],
  });
  if (!user) return res.status(404).json({ message: 'User not found' });

  // The counters do not depend on each other, so they run together.
  const historyRepo = AppDataSource.getRepository(ListenHistory);
  const [totalListened, uniqueRaw, totalPlaylists, totalFavorites] = await Promise.all([
    historyRepo.count({ where: { user: { id: userId } } }),
    historyRepo
      .createQueryBuilder('h')
      .select('COUNT(DISTINCT h.track_id)', 'cnt')
      .where('h.user_id = :uid', { uid: userId })
      .getRawOne<{ cnt: string }>(),
    AppDataSource.getRepository(Playlist).count({
      where: { user: { id: userId } },
    }),
    AppDataSource.getRepository(FavoriteTrack).count({
      where: { user: { id: userId } },
    }),
  ]);

  return res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role.name,
    createdAt: user.createdAt,
    stats: {
      totalListened,
      uniqueTracks: Number.parseInt(uniqueRaw?.cnt ?? '0', 10) || 0,
      totalPlaylists,
      totalFavorites,
    },
  });
}
