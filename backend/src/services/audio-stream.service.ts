import { get as httpGet } from 'http';
import { get as httpsGet } from 'https';
import fs from 'fs';
import fsp from 'fs/promises';
import { IncomingMessage } from 'http';
import { Transform } from 'stream';
import type { Request, Response } from 'express';
import { createLogger } from '../logger';
import { AudioCacheWriter, getCachedAudio } from './audio-cache.service';
import { TrackUnavailableError, ytdlpService } from './ytdlp.service';

const log = createLogger('audio-stream');

/**
 * Serving audio to the player.
 *
 * Three sources, tried in order of cost: the on-disk cache, the upstream URL
 * (mirrored into the cache on the way past), and — when a client skips around
 * inside one track — a fresh URL resolution. Anything that reaches the player
 * goes through here, so the clip endpoint and the track endpoint share one
 * implementation instead of one calling the other.
 */

const YOUTUBE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Referer: 'https://www.youtube.com/',
};

const PASSTHROUGH_HEADERS = ['content-type', 'content-length', 'accept-ranges'] as const;
const UPSTREAM_TIMEOUT_MS = 15000;
const MAX_PROXY_ATTEMPTS = 3;
const MAX_REDIRECTS = 3;

type UpstreamFailure = Error & { code?: string };

function errorCode(err: unknown): string {
  const e = err as { code?: unknown } | null;
  return typeof e?.code === 'string' ? e.code : '';
}

function errorMessage(err: unknown): string {
  const e = err as { message?: unknown } | null;
  return typeof e?.message === 'string' ? e.message.toLowerCase() : '';
}

/** The client gave up (skip, pause, closed tab), so nothing should be retried. */
function isClientAbort(err: unknown): boolean {
  const code = errorCode(err);
  if (code === 'ERR_STREAM_PREMATURE_CLOSE') return true;
  return errorMessage(err).includes('aborted') || errorMessage(err).includes('premature close');
}

/**
 * A connection-level failure worth trying again.
 *
 * `ECONNRESET` is deliberately absent: it means the peer hung up, and on a
 * streaming response that is the client leaving rather than the network
 * misbehaving. Callers decide which case they are in by checking the response
 * state first.
 */
function isRetryableUpstreamError(err: unknown): boolean {
  const code = errorCode(err);
  if (code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'EHOSTUNREACH') return true;
  const message = errorMessage(err);
  return message.includes('timeout') || message.includes('socket hang up');
}

function isRetryableStatus(statusCode: number): boolean {
  return statusCode === 403 || statusCode === 410 || statusCode === 429 || statusCode >= 500;
}

function requestUpstream(url: URL, headers: Record<string, string>): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const get = url.protocol === 'https:' ? httpsGet : httpGet;
    const req = get(url, { headers }, resolve);
    req.setTimeout(UPSTREAM_TIMEOUT_MS, () =>
      req.destroy(new Error('Upstream stream request timeout')),
    );
    req.on('error', reject);
  });
}

type CacheMirror = {
  sink: Transform;
  complete: Promise<void>;
  abort: () => Promise<void>;
};

/**
 * Streams the upstream body to the client while mirroring it to the cache in
 * the same pass, so the next play needs no download at all.
 *
 * Byte-range requests are never mirrored: a partial response would otherwise be
 * promoted to the cache as if it were the whole track.
 */
function pipeUpstreamToClient(
  upstreamRes: IncomingMessage,
  res: Response,
  cache: CacheMirror | null,
): void {
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstreamRes.headers[name];
    if (value !== undefined) res.setHeader(name, value);
  }
  res.status(upstreamRes.statusCode ?? 200);

  if (!cache) {
    upstreamRes.pipe(res);
    return;
  }

  cache.sink.on('error', () => {
    // A broken cache sink must never take the client stream down with it.
    upstreamRes.unpipe(cache.sink);
  });
  upstreamRes.on('error', () => {
    cache.sink.destroy();
    void cache.abort();
  });

  // 'close' also fires after a *successful* end, so the cache is only aborted
  // when the client left before the body was complete.
  res.on('close', () => {
    if (res.writableFinished) return;
    // destroy() alone emits neither 'finish' nor 'error', so the partial file
    // has to be removed here too or it lingers in the cache directory forever.
    cache.sink.destroy();
    void cache.abort();
  });

  upstreamRes.pipe(cache.sink).pipe(res);
}

/**
 * Serves a cached file with byte-range support. Returns false when the file
 * vanished, so the caller can fall back to upstream.
 */
async function serveFromDisk(filePath: string, req: Request, res: Response): Promise<boolean> {
  let stat: fs.Stats;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    return false;
  }

  const total = stat.size;
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', 'audio/mp4');
  res.setHeader('Cache-Control', 'public, max-age=86400');

  const range = req.headers.range;
  const match = typeof range === 'string' ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;

  if (match) {
    const start = match[1] ? Number.parseInt(match[1], 10) : 0;
    const end = match[2] ? Number.parseInt(match[2], 10) : total - 1;

    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= total) {
      res.status(416).setHeader('Content-Range', `bytes */${total}`);
      res.end();
      return true;
    }

    const lastByte = end >= total ? total - 1 : end;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${lastByte}/${total}`);
    res.setHeader('Content-Length', String(lastByte - start + 1));

    const stream = fs.createReadStream(filePath, { start, end: lastByte });
    stream.on('error', () => !res.writableEnded && res.end());
    stream.pipe(res);
    return true;
  }

  res.status(200);
  res.setHeader('Content-Length', String(total));
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => !res.writableEnded && res.end());
  stream.pipe(res);
  return true;
}

/**
 * Streams a track to the client, resolving a URL when necessary.
 *
 * Responds on the given `res` and resolves either way; callers should not
 * write to it afterwards.
 */
export async function streamTrack(req: Request, res: Response, trackId: string): Promise<void> {
  const id = trackId.trim();

  const range = req.headers.range;
  const headers: Record<string, string> = { ...YOUTUBE_HEADERS };
  // googlevideo answers 403 to a plain GET without a Range header and only
  // serves ranged requests, so an open-ended range is sent by default. The
  // upstream 206 passes through unchanged, so the client still sees a normal
  // full-length stream.
  headers.Range = typeof range === 'string' && range ? range : 'bytes=0-';

  const cached = await getCachedAudio(id);
  if (cached && (await serveFromDisk(cached, req, res))) return;

  let clientGone = false;
  req.on('close', () => {
    clientGone = true;
  });

  const clientLeft = (err?: unknown): boolean =>
    clientGone || res.writableEnded || (err !== undefined && isClientAbort(err));

  try {
    for (let attempt = 0; attempt < MAX_PROXY_ATTEMPTS; attempt += 1) {
      if (clientLeft()) return;

      // A fresh attempt forces a new URL: the previous one may be the expired
      // link rather than a transient network failure.
      let url = await ytdlpService.getStreamUrl(id, {
        forceRefresh: attempt > 0,
      });
      let redirectsLeft = MAX_REDIRECTS;

      while (redirectsLeft >= 0) {
        if (clientLeft()) return;

        let upstreamRes: IncomingMessage;
        try {
          upstreamRes = await requestUpstream(new URL(url), headers);
        } catch (err) {
          if (clientLeft(err)) return;
          if (isRetryableUpstreamError(err)) break;
          throw err;
        }

        const statusCode = upstreamRes.statusCode ?? 200;
        const location = upstreamRes.headers.location;
        if (
          statusCode >= 300 &&
          statusCode < 400 &&
          typeof location === 'string' &&
          location &&
          redirectsLeft > 0
        ) {
          upstreamRes.resume();
          url = new URL(location, url).toString();
          redirectsLeft -= 1;
          continue;
        }

        if (isRetryableStatus(statusCode)) {
          upstreamRes.resume();
          break;
        }

        res.on('close', () => upstreamRes.destroy());

        // Range responses are partial by definition and must not be cached.
        const cache =
          typeof range === 'string' && range.length > 0 ? null : AudioCacheWriter.start(id);

        upstreamRes.on('error', (err: UpstreamFailure) => {
          if (clientLeft(err)) return;
          if (!res.headersSent) res.status(502).json({ message: 'Failed to proxy stream' });
          else res.end();
        });

        pipeUpstreamToClient(upstreamRes, res, cache);
        return;
      }
    }

    if (!res.headersSent) res.status(502).json({ message: 'Failed to proxy stream' });
  } catch (err) {
    if (isClientAbort(err)) return;
    if (err instanceof TrackUnavailableError) {
      res.status(404).json({ message: 'Track is unavailable', reason: err.reason });
      return;
    }
    if (!res.headersSent) {
      log.error(err);
      res.status(502).json({ message: 'Failed to resolve stream URL' });
    } else {
      res.end();
    }
  }
}
