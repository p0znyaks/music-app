import { Request, Response } from 'express';
import { AppDataSource } from '../services/dataSource';
import { Playlist } from '../entities/playlist.entity';
import { PlaylistTrack } from '../entities/playlist-track.entity';
import { User } from '../entities/user.entity';
import { completeTrackMedia } from '../services/track-media.service';
import { clipShortCode, loadClipTimes } from '../services/tags/clip-times';
import {
  assessRemoval,
  deleteTagsForTrack,
  trackStillHasSource,
} from '../services/library/track-lifecycle.service';
import { routeId, routeParam, wantsForce } from '../http/params';

/** Longest playlist name the API accepts. */
const MAX_NAME_LENGTH = 25;

type PlaylistTrackResponse = {
  id: number;
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  duration: number | null;
  addedAt: Date;
  /** Present only for clip tracks. */
  startTime?: number;
  endTime?: number;
};

/** Finds a playlist owned by the caller, or null. */
async function findOwnedPlaylist(userId: number, playlistId: number): Promise<Playlist | null> {
  return AppDataSource.getRepository(Playlist).findOne({
    where: { id: playlistId, user: { id: userId } },
  });
}

/** POST /api/playlists */
export async function createPlaylist(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) return res.status(401).json({ message: 'Unauthorized' });

  const name = req.body?.name;
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'name is required' });
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    return res.status(400).json({ message: `name must be at most ${MAX_NAME_LENGTH} characters` });
  }

  const repo = AppDataSource.getRepository(Playlist);
  const playlist = repo.create({
    name: name.trim(),
    user: { id: userId } as User,
  });
  await repo.save(playlist);

  return res.status(201).json({
    id: playlist.id,
    name: playlist.name,
    createdAt: playlist.createdAt,
  });
}

/** DELETE /api/playlists/:id */
export async function deletePlaylist(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) return res.status(401).json({ message: 'Unauthorized' });

  const id = routeId(req.params.id);
  if (id === null) return res.status(400).json({ message: 'Invalid playlist id' });

  const repo = AppDataSource.getRepository(Playlist);
  const playlist = await findOwnedPlaylist(userId, id);
  if (!playlist) return res.status(404).json({ message: 'Playlist not found' });

  // Foreign keys require the child rows to go first.
  const trackRepo = AppDataSource.getRepository(PlaylistTrack);
  const rows = await trackRepo.find({
    where: { playlist: { id } },
    select: { trackId: true },
  });
  await trackRepo.delete({ playlist: { id } });
  await repo.remove(playlist);

  // A track only in this playlist is now an orphan, and its tags go with it.
  const trackIds = [...new Set(rows.map((row) => (row.trackId ?? '').trim()).filter(Boolean))];
  for (const trackId of trackIds) {
    if (await trackStillHasSource(userId, trackId)) continue;
    await deleteTagsForTrack(userId, trackId);
  }

  return res.status(204).send();
}

/** GET /api/playlists */
export async function listPlaylists(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) return res.status(401).json({ message: 'Unauthorized' });

  const list = await AppDataSource.getRepository(Playlist).find({
    where: { user: { id: userId } },
    order: { createdAt: 'DESC' },
  });

  return res.json(
    list.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      createdAt: playlist.createdAt,
    })),
  );
}

/** POST /api/playlists/:id/tracks */
export async function addPlaylistTrack(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) return res.status(401).json({ message: 'Unauthorized' });

  const playlistId = routeId(req.params.id);
  if (playlistId === null) return res.status(400).json({ message: 'Invalid playlist id' });

  const { trackId, title, artist, thumbnailUrl, duration, isClip } = req.body ?? {};
  if (typeof trackId !== 'string' || !trackId.trim()) {
    return res.status(400).json({ message: 'trackId is required' });
  }
  if (typeof title !== 'string' || typeof artist !== 'string') {
    return res.status(400).json({ message: 'title and artist are required' });
  }

  const playlist = await findOwnedPlaylist(userId, playlistId);
  if (!playlist) return res.status(404).json({ message: 'Playlist not found' });

  const repo = AppDataSource.getRepository(PlaylistTrack);
  const normalizedTrackId = trackId.trim();

  // Clips are distinct cuts of the same track, so uniqueness is by name for
  // them and by track id for ordinary tracks.
  const duplicate =
    isClip === true
      ? await repo
          .createQueryBuilder('pt')
          .where('pt.playlist_id = :playlistId', { playlistId })
          .andWhere('LOWER(TRIM(pt.title)) = :normalizedTitle', {
            normalizedTitle: title.trim().toLowerCase(),
          })
          .getExists()
      : (await repo.findOne({
          where: { playlist: { id: playlistId }, trackId: normalizedTrackId },
        })) !== null;

  if (duplicate) {
    return res.status(409).json({
      message:
        isClip === true ? 'Clip with this name already in playlist' : 'Track already in playlist',
    });
  }

  const media = await completeTrackMedia({ trackId, thumbnailUrl, duration });
  const row = repo.create({
    playlist,
    trackId: normalizedTrackId,
    title,
    artist,
    thumbnailUrl: media.thumbnailUrl,
    duration: media.duration,
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

/** DELETE /api/playlists/:id/tracks/:trackId */
export async function removePlaylistTrack(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) return res.status(401).json({ message: 'Unauthorized' });

  const id = routeId(req.params.id);
  const trackId = routeParam(req.params.trackId);
  if (id === null || !trackId)
    return res.status(400).json({ message: 'Invalid playlist or track id' });

  const force = wantsForce(req.query);

  const playlist = await findOwnedPlaylist(userId, id);
  if (!playlist) return res.status(404).json({ message: 'Playlist not found' });

  const repo = AppDataSource.getRepository(PlaylistTrack);
  const row = await repo.findOne({ where: { playlist: { id }, trackId } });
  if (!row) return res.status(404).json({ message: 'Track not found in playlist' });

  // Excluding this playlist, the track is orphaned only if nothing else holds it.
  const impact = await assessRemoval(userId, trackId, {
    excludePlaylistId: id,
  });
  if (!impact.stillReferenced && impact.tagCount > 0 && !force) {
    return res.status(409).json({
      message: 'Track has tags. Confirmation required.',
      requiresConfirm: true,
      hasTags: true,
      tagCount: impact.tagCount,
    });
  }

  await repo.remove(row);

  if (!impact.stillReferenced) {
    await deleteTagsForTrack(userId, trackId);
  }

  return res.status(204).send();
}

/** GET /api/playlists/:id/tracks */
export async function listPlaylistTracks(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) return res.status(401).json({ message: 'Unauthorized' });

  const id = routeId(req.params.id);
  if (id === null) return res.status(400).json({ message: 'Invalid playlist id' });

  const playlist = await findOwnedPlaylist(userId, id);
  if (!playlist) return res.status(404).json({ message: 'Playlist not found' });

  const tracks = await AppDataSource.getRepository(PlaylistTrack).find({
    where: { playlist: { id } },
    order: { addedAt: 'ASC' },
  });

  const clipTimes = await loadClipTimes(tracks.map((row) => row.trackId));

  return res.json(
    tracks.map((row) => {
      const track: PlaylistTrackResponse = {
        id: row.id,
        trackId: row.trackId,
        title: row.title,
        artist: row.artist,
        thumbnailUrl: row.thumbnailUrl,
        duration: row.duration,
        addedAt: row.addedAt,
      };

      const shortCode = clipShortCode(row.trackId);
      const clip = shortCode ? clipTimes.get(shortCode) : undefined;
      if (clip) {
        track.startTime = clip.startTime;
        track.endTime = clip.endTime;
      }
      return track;
    }),
  );
}
