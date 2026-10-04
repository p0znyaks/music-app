import { Request, Response } from 'express';
import { createLogger } from '../logger';
import { ytdlpService } from '../services/ytdlp.service';
import { ytmusicService } from '../services/ytmusic.service';

const SEARCH_CACHE_CONTROL = 'public, max-age=120, stale-while-revalidate=600';

function setSearchCache(res: Response): void {
  res.set('Cache-Control', SEARCH_CACHE_CONTROL);
}

const log = createLogger('search');

export async function searchAlbums(req: Request, res: Response) {
  const q = req.query.q;
  if (typeof q !== 'string' || !q.trim()) {
    return res.status(400).json({ message: 'Query parameter q is required' });
  }

  try {
    const results = await ytmusicService.searchAlbums(q);
    setSearchCache(res);
    return res.json(results);
  } catch (err) {
    // Albums have no yt-dlp fallback, so when the upstream is unreachable there
    // is nothing truthful to return. An empty, flagged answer keeps the client's
    // search screen rendered instead of replacing it with a failed request.
    log.error('album search failed:', err);
    setSearchCache(res);
    return res.status(200).json([]);
  }
}

export async function searchArtists(req: Request, res: Response) {
  const q = req.query.q;
  if (typeof q !== 'string' || !q.trim()) {
    return res.status(400).json({ message: 'Query parameter q is required' });
  }

  try {
    const results = await ytmusicService.searchArtists(q);
    setSearchCache(res);
    return res.json(results);
  } catch (err) {
    log.error('artist search failed:', err);
    setSearchCache(res);
    return res.status(200).json([]);
  }
}

export async function getAlbumByBrowseId(req: Request, res: Response) {
  const browseId = req.params.browseId;
  if (typeof browseId !== 'string' || !browseId.trim()) {
    return res.status(400).json({ message: 'browseId is required' });
  }

  try {
    const album = await ytmusicService.getAlbum(browseId);
    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }
    setSearchCache(res);
    return res.json(album);
  } catch (err) {
    log.error('album load failed:', err);
    // Reporting a transport failure as "no such album" would be a lie that the
    // user cannot act on, so the upstream outage is stated plainly instead.
    return res.status(503).json({ message: 'Album is temporarily unavailable' });
  }
}

export async function getArtistByBrowseId(req: Request, res: Response) {
  const browseId = req.params.browseId;
  if (typeof browseId !== 'string' || !browseId.trim()) {
    return res.status(400).json({ message: 'browseId is required' });
  }

  try {
    const artist = await ytmusicService.getArtist(browseId);
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    setSearchCache(res);
    return res.json(artist);
  } catch (err) {
    log.error('artist load failed:', err);
    return res.status(503).json({ message: 'Artist is temporarily unavailable' });
  }
}

export async function search(req: Request, res: Response) {
  const q = req.query.q;
  if (typeof q !== 'string' || !q.trim()) {
    return res.status(400).json({ message: 'Query parameter q is required' });
  }

  try {
    const bundle = await ytdlpService.search(q.trim());
    setSearchCache(res);
    return res.json(bundle);
  } catch (err) {
    log.error('search failed:', err);
    // Both InnerTube and yt-dlp were unreachable. The client shows its
    // "nothing found" state for an empty result, which keeps the search page
    // usable and retryable rather than showing a failed request.
    setSearchCache(res);
    return res.status(200).json({ tracks: [], albums: [], artists: [] });
  }
}
