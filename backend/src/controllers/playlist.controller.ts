import { Request, Response } from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../services/dataSource';
import { Playlist } from '../entities/playlist.entity';
import { PlaylistTrack } from '../entities/playlist-track.entity';
import { FavoriteTrack } from '../entities/favorite-track.entity';
import { TrackTag } from '../entities/track-tag.entity';
import { User } from '../entities/user.entity';
import { Clip } from '../entities/clip.entity';

function parsePlaylistId(raw: string | string[] | undefined): number | null {
  if (raw === undefined) {
    return null;
  }
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (typeof s !== 'string' || s === '') {
    return null;
  }
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function paramTrackId(raw: string | string[] | undefined): string {
  if (raw === undefined) {
    return '';
  }
  const s = Array.isArray(raw) ? raw[0] : raw;
  return typeof s === 'string' ? decodeURIComponent(s) : '';
}

export async function createPlaylist(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const name = req.body?.name;
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'name is required' });
  }
  if (name.trim().length > 25) {
    return res.status(400).json({ message: 'name must be at most 25 characters' });
  }

  const playlistRepo = AppDataSource.getRepository(Playlist);
  const playlist = playlistRepo.create({
    name: name.trim(),
    user: { id: userId } as User,
  });
  await playlistRepo.save(playlist);
  return res.status(201).json({
    id: playlist.id,
    name: playlist.name,
    createdAt: playlist.createdAt,
  });
}

export async function deletePlaylist(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const id = parsePlaylistId(req.params.id);
  if (id === null) {
    return res.status(400).json({ message: 'Invalid playlist id' });
  }

  const playlistRepo = AppDataSource.getRepository(Playlist);
  const playlist = await playlistRepo.findOne({
    where: { id, user: { id: userId } },
  });
  if (!playlist) {
    return res.status(404).json({ message: 'Playlist not found' });
  }

  // Postgres FK constraints: playlist_tracks must be removed first
  const playlistTrackRepo = AppDataSource.getRepository(PlaylistTrack);
  const rows = await playlistTrackRepo.find({
    where: { playlist: { id } },
    select: { trackId: true },
  });
  const trackIds = [...new Set(rows.map((r) => r.trackId).filter((t) => typeof t === 'string' && t.trim().length > 0))];

  await playlistTrackRepo.delete({ playlist: { id } });

  await playlistRepo.remove(playlist);

  // Cleanup tags for tracks that became "orphan" (not in any playlist and not in favorites).
  if (trackIds.length > 0) {
    const favRepo = AppDataSource.getRepository(FavoriteTrack);
    const tagRepo = AppDataSource.getRepository(TrackTag);

    for (const trackId of trackIds) {
      const favExists = await favRepo.findOne({ where: { user: { id: userId }, trackId } });
      if (favExists) {
        continue;
      }
      const stillInAnyPlaylist = await playlistTrackRepo
        .createQueryBuilder('pt')
        .innerJoin('pt.playlist', 'p')
        .where('p.user_id = :uid', { uid: userId })
        .andWhere('pt.trackId = :tid', { tid: trackId })
        .getExists();
      if (!stillInAnyPlaylist) {
        await tagRepo
          .createQueryBuilder()
          .delete()
          .where('user_id = :uid', { uid: userId })
          .andWhere('track_id = :tid', { tid: trackId })
          .execute();
      }
    }
  }

  return res.status(204).send();
}

export async function listPlaylists(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const playlistRepo = AppDataSource.getRepository(Playlist);
  const list = await playlistRepo.find({
    where: { user: { id: userId } },
    order: { createdAt: 'DESC' },
  });
  return res.json(
    list.map((p) => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
    })),
  );
}

export async function addPlaylistTrack(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const playlistId = parsePlaylistId(req.params.id);
  if (playlistId === null) {
    return res.status(400).json({ message: 'Invalid playlist id' });
  }

  const body = req.body ?? {};
  const { trackId, title, artist, thumbnailUrl, duration, isClip } = body;
  if (typeof trackId !== 'string' || !trackId.trim()) {
    return res.status(400).json({ message: 'trackId is required' });
  }
  if (typeof title !== 'string' || typeof artist !== 'string') {
    return res.status(400).json({ message: 'title and artist are required' });
  }

  const playlistRepo = AppDataSource.getRepository(Playlist);
  const playlist = await playlistRepo.findOne({
    where: { id: playlistId, user: { id: userId } },
  });
  if (!playlist) {
    return res.status(404).json({ message: 'Playlist not found' });
  }

  const playlistTrackRepo = AppDataSource.getRepository(PlaylistTrack);
  const normalizedTrackId = trackId.trim();
  if (isClip === true) {
    const normalizedTitle = title.trim().toLowerCase();
    const existingClipName = await playlistTrackRepo
      .createQueryBuilder('pt')
      .where('pt.playlist_id = :playlistId', { playlistId })
      .andWhere('LOWER(TRIM(pt.title)) = :normalizedTitle', { normalizedTitle })
      .getExists();
    if (existingClipName) {
      return res.status(409).json({ message: 'Clip with this name already in playlist' });
    }
  } else {
    const existing = await playlistTrackRepo.findOne({
      where: { playlist: { id: playlistId }, trackId: normalizedTrackId },
    });
    if (existing) {
      return res.status(409).json({ message: 'Track already in playlist' });
    }
  }

  const row = playlistTrackRepo.create({
    playlist,
    trackId: normalizedTrackId,
    title,
    artist,
    thumbnailUrl: typeof thumbnailUrl === 'string' ? thumbnailUrl : null,
    duration: typeof duration === 'number' && Number.isFinite(duration) ? Math.floor(duration) : null,
  });
  await playlistTrackRepo.save(row);
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

export async function removePlaylistTrack(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const id = parsePlaylistId(req.params.id);
  const trackId = paramTrackId(req.params.trackId);
  if (id === null || !trackId) {
    return res.status(400).json({ message: 'Invalid playlist or track id' });
  }

  const force = (req.query as any)?.force === '1';

  const playlistRepo = AppDataSource.getRepository(Playlist);
  const playlist = await playlistRepo.findOne({
    where: { id, user: { id: userId } },
  });
  if (!playlist) {
    return res.status(404).json({ message: 'Playlist not found' });
  }

  const trackRepo = AppDataSource.getRepository(PlaylistTrack);
  const row = await trackRepo.findOne({
    where: { playlist: { id }, trackId },
  });
  if (!row) {
    return res.status(404).json({ message: 'Track not found in playlist' });
  }

  const tagRepo = AppDataSource.getRepository(TrackTag);
  const tagCount = await tagRepo.count({ where: { user: { id: userId }, trackId } });

  const favRepo = AppDataSource.getRepository(FavoriteTrack);
  const favExists = await favRepo.findOne({ where: { user: { id: userId }, trackId } });

  const otherPlaylistCount = await trackRepo
    .createQueryBuilder('pt')
    .innerJoin('pt.playlist', 'p')
    .where('p.user_id = :uid', { uid: userId })
    .andWhere('pt.trackId = :tid', { tid: trackId })
    .andWhere('p.id != :pid', { pid: id })
    .getCount();

  const willHaveNoSources = !favExists && otherPlaylistCount === 0;
  if (!force && tagCount > 0 && willHaveNoSources) {
    return res.status(409).json({
      message: 'Track has tags. Confirmation required.',
      requiresConfirm: true,
      hasTags: true,
      tagCount,
    });
  }

  await trackRepo.remove(row);

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

export async function listPlaylistTracks(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const id = parsePlaylistId(req.params.id);
  if (id === null) {
    return res.status(400).json({ message: 'Invalid playlist id' });
  }

  const playlistRepo = AppDataSource.getRepository(Playlist);
  const playlist = await playlistRepo.findOne({
    where: { id, user: { id: userId } },
  });
  if (!playlist) {
    return res.status(404).json({ message: 'Playlist not found' });
  }

  const trackRepo = AppDataSource.getRepository(PlaylistTrack);
  const tracks = await trackRepo.find({
    where: { playlist: { id } },
    order: { addedAt: 'ASC' },
  });

  const clipShortCodes = tracks
    .filter((t) => t.trackId.startsWith('clip:'))
    .map((t) => t.trackId.slice(5));

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
    tracks.map((t) => {
      const base: any = {
        id: t.id,
        trackId: t.trackId,
        title: t.title,
        artist: t.artist,
        thumbnailUrl: t.thumbnailUrl,
        duration: t.duration,
        addedAt: t.addedAt,
      };
      if (t.trackId.startsWith('clip:')) {
        const sc = t.trackId.slice(5);
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
