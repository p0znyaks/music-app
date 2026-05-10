import { Request, Response } from 'express';
import { parseEnvelope, stringifyEnvelope } from '../services/cache-swr';
import { rewriteImageUrlsDeep } from '../services/image-proxy.service';
import { ytdlpService, type SearchBundle } from '../services/ytdlp.service';
import { ytmusicService } from '../services/ytmusic.service';
import { getRedis } from '../services/redis';

const SEARCH_CACHE_CONTROL = 'public, max-age=120, stale-while-revalidate=600';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const SEARCH_BUNDLE_TTL_SEC = envInt('REDIS_TTL_YTDLP_SEC', 86400);
const SEARCH_BUNDLE_KEY = (q: string) => `search:bundle:v10:${q.trim()}`;

function setSearchCache(res: Response): void {
  res.set('Cache-Control', SEARCH_CACHE_CONTROL);
}

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
    console.error(err);
    return res.status(502).json({ message: 'Album search failed' });
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
    console.error(err);
    return res.status(502).json({ message: 'Artist search failed' });
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
    console.error(err);
    return res.status(502).json({ message: 'Failed to load album' });
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
    console.error(err);
    return res.status(502).json({ message: 'Failed to load artist' });
  }
}

function writeNdjson(res: Response, obj: unknown): void {
  res.write(`${JSON.stringify(rewriteImageUrlsDeep(obj))}\n`);
}

function streamSearchBundleFromCache(res: Response, bundle: SearchBundle, query: string): void {
  writeNdjson(res, { kind: 'meta', query });
  writeNdjson(res, { kind: 'tracks', partial: true, items: bundle.tracks.slice(0, 15) });
  writeNdjson(res, { kind: 'tracks', partial: false, items: bundle.tracks.slice(15) });
  writeNdjson(res, { kind: 'albums', items: bundle.albums });
  writeNdjson(res, { kind: 'artists', items: bundle.artists });
}

export async function search(req: Request, res: Response) {
  const q = req.query.q;
  if (typeof q !== 'string' || !q.trim()) {
    return res.status(400).json({ message: 'Query parameter q is required' });
  }

  const trimmed = q.trim();
  const accept = String(req.headers.accept ?? '');
  const wantsStream = accept.includes('application/x-ndjson');

  try {
    if (!wantsStream) {
      const bundle = await ytdlpService.search(trimmed);
      setSearchCache(res);
      return res.json(bundle);
    }

    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    const redis = getRedis();
    const key = SEARCH_BUNDLE_KEY(trimmed);
    const cachedRaw = await redis.get(key);
    if (cachedRaw) {
      const env = parseEnvelope<SearchBundle>(cachedRaw);
      if (env?.data) {
        streamSearchBundleFromCache(res, env.data, trimmed);
        writeNdjson(res, { kind: 'done' });
        return res.end();
      }
    }

    const bundle = await ytdlpService.searchStreaming(trimmed, (phase) => {
      if (phase.phase === 'meta') {
        writeNdjson(res, { kind: 'meta', query: phase.query });
      } else if (phase.phase === 'tracks') {
        writeNdjson(res, { kind: 'tracks', partial: phase.partial, items: phase.items });
      } else if (phase.phase === 'albums') {
        writeNdjson(res, { kind: 'albums', items: phase.items });
      } else if (phase.phase === 'artists') {
        writeNdjson(res, { kind: 'artists', items: phase.items });
      }
    });

    await redis.set(key, stringifyEnvelope(bundle), 'EX', SEARCH_BUNDLE_TTL_SEC);
    writeNdjson(res, { kind: 'done' });
    return res.end();
  } catch (err) {
    console.error(err);
    if (res.headersSent) {
      return res.end();
    }
    return res.status(502).json({ message: 'Search failed' });
  }
}
