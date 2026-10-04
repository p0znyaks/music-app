import { Request, Response } from 'express';
import { createLogger } from '../logger';
import { streamTrack } from '../services/audio-stream.service';
import { TrackUnavailableError, ytdlpService } from '../services/ytdlp.service';
import { routeParam } from '../http/params';

/**
 * Track endpoints.
 *
 * The handlers only resolve the track id and map errors onto status codes; the
 * streaming itself lives in `audio-stream.service` so the clip endpoint can
 * reuse it without reaching into another controller.
 */

function requireTrackId(req: Request, res: Response): string | null {
  const trackId = routeParam(req.params.trackId);
  if (!trackId.trim()) {
    res.status(400).json({ message: 'trackId is required' });
    return null;
  }
  return trackId;
}

/** GET /api/tracks/:trackId/proxy-stream */
const log = createLogger('track');

export async function getProxyStream(req: Request, res: Response) {
  const trackId = requireTrackId(req, res);
  if (trackId === null) return;

  await streamTrack(req, res, trackId);
}

/** GET /api/tracks/:trackId/stream */
export async function getStreamUrl(req: Request, res: Response) {
  const trackId = requireTrackId(req, res);
  if (trackId === null) return;

  try {
    return res.json({ url: await ytdlpService.getStreamUrl(trackId) });
  } catch (err) {
    if (err instanceof TrackUnavailableError) {
      return res.status(404).json({ message: 'Track is unavailable', reason: err.reason });
    }
    log.error(err);
    return res.status(502).json({ message: 'Failed to resolve stream URL' });
  }
}

/** GET /api/tracks/:trackId/metadata */
export async function getMetadata(req: Request, res: Response) {
  const trackId = requireTrackId(req, res);
  if (trackId === null) return;

  try {
    return res.json(await ytdlpService.getMetadata(trackId));
  } catch (err) {
    log.error(err);
    return res.status(502).json({ message: 'Failed to fetch track metadata' });
  }
}
