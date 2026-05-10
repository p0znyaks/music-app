import { get as httpGet } from 'http';
import { get as httpsGet } from 'https';
import { IncomingMessage } from 'http';
import { Request, Response } from 'express';
import { ytdlpService } from '../services/ytdlp.service';

const YOUTUBE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Referer: 'https://www.youtube.com/',
};

const PASSTHROUGH_HEADERS = ['content-type', 'content-length', 'accept-ranges'] as const;
const UPSTREAM_TIMEOUT_MS = 15000;
const MAX_PROXY_ATTEMPTS = 3;
const MAX_REDIRECTS = 3;

function shouldRetryUpstreamStatus(statusCode: number): boolean {
  return statusCode === 403 || statusCode === 410 || statusCode === 429 || statusCode >= 500;
}

function shouldRetryUpstreamError(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === 'string' ? e.code : '';
  if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'EHOSTUNREACH') {
    return true;
  }
  const message = typeof e?.message === 'string' ? e.message.toLowerCase() : '';
  return message.includes('timeout') || message.includes('socket hang up');
}

function isClientAbort(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === 'string' ? e.code : '';
  if (code === 'ECONNRESET' || code === 'ERR_STREAM_PREMATURE_CLOSE') {
    return true;
  }
  const message = typeof e?.message === 'string' ? e.message.toLowerCase() : '';
  return message.includes('aborted') || message.includes('premature close');
}

function requestUpstream(url: URL, headers: Record<string, string>): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const get = url.protocol === 'https:' ? httpsGet : httpGet;
    const req = get(url, { headers }, (upstreamRes) => {
      resolve(upstreamRes);
    });
    req.setTimeout(UPSTREAM_TIMEOUT_MS, () => {
      req.destroy(new Error('Upstream stream request timeout'));
    });
    req.on('error', reject);
  });
}

function pipeUpstreamToClient(upstreamRes: IncomingMessage, res: Response): void {
  for (const name of PASSTHROUGH_HEADERS) {
    const val = upstreamRes.headers[name];
    if (val !== undefined) {
      res.setHeader(name, val);
    }
  }
  res.status(upstreamRes.statusCode ?? 200);
  upstreamRes.pipe(res);
}

function paramTrackId(raw: string | string[] | undefined): string {
  if (raw === undefined) {
    return '';
  }
  const s = Array.isArray(raw) ? raw[0] : raw;
  return typeof s === 'string' ? s : '';
}

export async function getProxyStream(req: Request, res: Response) {
  const trackId = paramTrackId(req.params.trackId);
  if (!trackId.trim()) {
    return res.status(400).json({ message: 'trackId is required' });
  }

  try {
    const headers: Record<string, string> = { ...YOUTUBE_HEADERS };
    const range = req.headers.range;
    if (typeof range === 'string' && range) {
      headers.Range = range;
    }

    let clientDisconnected = false;
    req.on('close', () => {
      clientDisconnected = true;
    });

    for (let attempt = 0; attempt < MAX_PROXY_ATTEMPTS; attempt += 1) {
      if (clientDisconnected || res.writableEnded) {
        return;
      }
      let directUrl = await ytdlpService.getStreamUrl(trackId, { forceRefresh: attempt > 0 });
      let redirectsLeft = MAX_REDIRECTS;

      while (redirectsLeft >= 0) {
        if (clientDisconnected || res.writableEnded) {
          return;
        }
        let upstreamRes: IncomingMessage;
        try {
          upstreamRes = await requestUpstream(new URL(directUrl), headers);
        } catch (err) {
          if (clientDisconnected || isClientAbort(err)) {
            return;
          }
          if (shouldRetryUpstreamError(err) && attempt < MAX_PROXY_ATTEMPTS - 1) {
            break;
          }
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
          directUrl = new URL(location, directUrl).toString();
          redirectsLeft -= 1;
          continue;
        }

        if (shouldRetryUpstreamStatus(statusCode) && attempt < MAX_PROXY_ATTEMPTS - 1) {
          upstreamRes.resume();
          break;
        }

        res.on('close', () => {
          upstreamRes.destroy();
        });
        upstreamRes.on('error', (err) => {
          if (clientDisconnected || isClientAbort(err) || res.writableEnded) {
            return;
          }
          if (!res.headersSent) {
            res.status(502).json({ message: 'Failed to proxy stream' });
          } else {
            res.end();
          }
        });

        pipeUpstreamToClient(upstreamRes, res);
        return;
      }
    }

    if (!res.headersSent) {
      return res.status(502).json({ message: 'Failed to proxy stream' });
    }
  } catch (err) {
    if (isClientAbort(err)) {
      return;
    }
    console.error(err);
    return res.status(502).json({ message: 'Failed to resolve stream URL' });
  }
}

export async function getStreamUrl(req: Request, res: Response) {
  const trackId = paramTrackId(req.params.trackId);
  if (!trackId.trim()) {
    return res.status(400).json({ message: 'trackId is required' });
  }

  try {
    const url = await ytdlpService.getStreamUrl(trackId);
    return res.json({ url });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ message: 'Failed to resolve stream URL' });
  }
}

export async function getMetadata(req: Request, res: Response) {
  const trackId = paramTrackId(req.params.trackId);
  if (!trackId.trim()) {
    return res.status(400).json({ message: 'trackId is required' });
  }

  try {
    const metadata = await ytdlpService.getMetadata(trackId);
    return res.json(metadata);
  } catch (err) {
    console.error(err);
    return res.status(502).json({ message: 'Failed to fetch track metadata' });
  }
}
