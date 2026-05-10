import { Request, Response } from 'express';
import { AppDataSource } from '../services/dataSource';
import { User } from '../entities/user.entity';
import { ListenHistory } from '../entities/listen-history.entity';
import { Playlist } from '../entities/playlist.entity';
import { FavoriteTrack } from '../entities/favorite-track.entity';

export async function getProfile(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({
    where: { id: userId },
    relations: ['role'],
  });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const historyRepo = AppDataSource.getRepository(ListenHistory);
  const totalListened = await historyRepo.count({ where: { user: { id: userId } } });

  const uniqueRaw = await historyRepo
    .createQueryBuilder('h')
    .select('COUNT(DISTINCT h.track_id)', 'cnt')
    .where('h.user_id = :uid', { uid: userId })
    .getRawOne<{ cnt: string }>();
  const uniqueTracks = parseInt(uniqueRaw?.cnt ?? '0', 10) || 0;

  const totalPlaylists = await AppDataSource.getRepository(Playlist).count({
    where: { user: { id: userId } },
  });
  const totalFavorites = await AppDataSource.getRepository(FavoriteTrack).count({
    where: { user: { id: userId } },
  });

  return res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role.name,
    createdAt: user.createdAt,
    stats: {
      totalListened,
      uniqueTracks,
      totalPlaylists,
      totalFavorites,
    },
  });
}
