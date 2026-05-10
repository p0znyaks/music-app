import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { AppDataSource } from '../services/dataSource';
import { Clip } from '../entities/clip.entity';
import { User } from '../entities/user.entity';
import { getProxyStream } from './track.controller';
import { ytdlpService } from '../services/ytdlp.service';

function paramShortCode(raw: string | string[] | undefined): string {
  if (raw === undefined) {
    return '';
  }
  const s = Array.isArray(raw) ? raw[0] : raw;
  return typeof s === 'string' ? s : '';
}

export async function createClip(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { trackId, title, artist, thumbnailUrl, startTime, endTime, clipName } = req.body ?? {};
  if (typeof trackId !== 'string' || !trackId.trim()) {
    return res.status(400).json({ message: 'trackId is required' });
  }
  if (trackId.trim().startsWith('clip:')) {
    return res.status(400).json({ message: 'Cannot create a clip from a clip' });
  }
  if (typeof title !== 'string' || typeof artist !== 'string') {
    return res.status(400).json({ message: 'title and artist are required' });
  }
  if (typeof clipName !== 'string' || !clipName.trim()) {
    return res.status(400).json({ message: 'clipName is required' });
  }
  if (typeof startTime !== 'number' || typeof endTime !== 'number' || !Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return res.status(400).json({ message: 'startTime and endTime must be numbers (seconds)' });
  }
  if (endTime <= startTime) {
    return res.status(400).json({ message: 'endTime must be greater than startTime' });
  }

  const repo = AppDataSource.getRepository(Clip);
  const maxAttempts = 8;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shortCode = randomBytes(6).toString('hex');
    const exists = await repo.exist({ where: { shortCode } });
    if (exists) {
      continue;
    }

    const clip = repo.create({
      user: { id: userId } as User,
      trackId: trackId.trim(),
      title: clipName.trim(),
      artist,
      thumbnailUrl: typeof thumbnailUrl === 'string' && thumbnailUrl.trim() ? thumbnailUrl : '/clip-cover.svg',
      startTime: Math.floor(startTime),
      endTime: Math.floor(endTime),
      shortCode,
    });

    try {
      await repo.save(clip);
      return res.status(201).json({
        id: clip.id,
        shortCode: clip.shortCode,
        trackId: clip.trackId,
        title: clip.title,
        artist: clip.artist,
        thumbnailUrl: clip.thumbnailUrl,
        startTime: clip.startTime,
        endTime: clip.endTime,
        createdAt: clip.createdAt,
      });
    } catch {
      continue;
    }
  }

  return res.status(500).json({ message: 'Could not generate unique short code' });
}

export async function getClipByShortCode(req: Request, res: Response) {
  const shortCode = paramShortCode(req.params.shortCode);
  if (!shortCode) {
    return res.status(400).json({ message: 'shortCode is required' });
  }

  const repo = AppDataSource.getRepository(Clip);
  const clip = await repo.findOne({ where: { shortCode } });
  if (!clip) {
    return res.status(404).json({ message: 'Clip not found' });
  }

  let originalThumbnailUrl = clip.thumbnailUrl;
  if (!originalThumbnailUrl || originalThumbnailUrl === '/clip-cover.svg') {
    try {
      const meta = await ytdlpService.getMetadata(clip.trackId);
      originalThumbnailUrl = meta.thumbnailUrl || null;
    } catch {
      originalThumbnailUrl = null;
    }
  }

  return res.json({
    trackId: clip.trackId,
    title: clip.title,
    artist: clip.artist,
    thumbnailUrl: originalThumbnailUrl,
    startTime: clip.startTime,
    endTime: clip.endTime,
  });
}

export async function proxyClipByShortCode(req: Request, res: Response) {
  const shortCode = paramShortCode(req.params.shortCode);
  if (!shortCode) {
    return res.status(400).json({ message: 'shortCode is required' });
  }

  const repo = AppDataSource.getRepository(Clip);
  const clip = await repo.findOne({ where: { shortCode } });
  if (!clip) {
    return res.status(404).json({ message: 'Clip not found' });
  }

  req.params.trackId = clip.trackId;
  return getProxyStream(req, res);
}
