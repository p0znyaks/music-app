import { getRedis } from './redis';

const IMAGE_PROXY_PREFIX = '/api/images/proxy?u=';
const IMAGE_CACHE_TTL_SEC = 60 * 60 * 24 * 7;
const MAX_RETRIES = 3;
const MAX_CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 12000;
const YT_AVATAR_STYLE = 's512-c-k-c0x00ffffff-no-rj';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host === '::1') return true;
  if (/^127\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  const m = /^172\.(\d+)\.\d+\.\d+$/.exec(host);
  if (m) {
    const n = Number.parseInt(m[1] ?? '', 10);
    if (Number.isFinite(n) && n >= 16 && n <= 31) return true;
  }
  return false;
}

function isGoogleImageHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host.endsWith('.ggpht.com') || host.endsWith('.googleusercontent.com');
}

function buildGoogleImageCandidates(rawUrl: string): string[] {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return [rawUrl];
  }
  if (!isGoogleImageHost(parsed.hostname)) {
    return [rawUrl];
  }

  const candidates: string[] = [];
  const add = (val: string) => {
    if (!candidates.includes(val)) {
      candidates.push(val);
    }
  };

  add(rawUrl);

  const canonical = rewriteGoogleImageUrl(parsed);
  add(canonical);

  const basePath = parsed.pathname.split('=')[0] ?? parsed.pathname;
  if (basePath) {
    const base = new URL(parsed.toString());
    base.pathname = `${basePath}=${YT_AVATAR_STYLE}`;
    add(base.toString());

    const alt = new URL(parsed.toString());
    alt.pathname = `${basePath}=s1024-c-k-c0x00ffffff-no-rj`;
    add(alt.toString());
  }

  const hostVariants = ['yt3.googleusercontent.com', 'lh3.googleusercontent.com'];
  const currentHost = parsed.hostname.toLowerCase();
  if (currentHost === 'yt3.ggpht.com' || currentHost === 'yt3.googleusercontent.com' || currentHost === 'lh3.googleusercontent.com') {
    const existing = [...candidates];
    for (const host of hostVariants) {
      for (const candidate of existing) {
        try {
          const u = new URL(candidate);
          u.hostname = host;
          add(u.toString());
        } catch {
          // Ignore malformed candidate variants.
        }
      }
    }
  }

  return candidates;
}

function rewriteGoogleImageUrl(parsed: URL): string {
  if (!isGoogleImageHost(parsed.hostname)) {
    return parsed.toString();
  }
  const out = new URL(parsed.toString());
  // ggpht avatars usually encode transform options as "=<style>" suffix.
  // Some variants intermittently return 400, so normalize to a stable style.
  out.pathname = out.pathname.replace(/=[^/]*$/, `=${YT_AVATAR_STYLE}`);
  return out.toString();
}

export function normalizeExternalImageUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(IMAGE_PROXY_PREFIX)) return trimmed;
  const normalized = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (isPrivateHost(parsed.hostname)) return null;
  return rewriteGoogleImageUrl(parsed);
}

export function toImageProxyUrl(input: string): string {
  if (input.startsWith(IMAGE_PROXY_PREFIX)) {
    return input;
  }
  return `${IMAGE_PROXY_PREFIX}${encodeURIComponent(input)}`;
}

type JsonLike = null | boolean | number | string | JsonLike[] | { [k: string]: JsonLike };

export function rewriteImageUrlsDeep<T>(value: T): T {
  const walk = (node: JsonLike): JsonLike => {
    if (Array.isArray(node)) {
      return node.map((item) => walk(item));
    }
    if (!node || typeof node !== 'object') {
      return node;
    }
    const out: Record<string, JsonLike> = {};
    for (const [key, raw] of Object.entries(node)) {
      if (typeof raw === 'string' && key === 'thumbnailUrl') {
        const normalized = normalizeExternalImageUrl(raw);
        out[key] = normalized ? toImageProxyUrl(normalized) : raw;
        continue;
      }
      if (Array.isArray(raw) && key === 'previewThumbs') {
        out[key] = raw.map((item) => {
          if (typeof item !== 'string') return item;
          const normalized = normalizeExternalImageUrl(item);
          return normalized ? toImageProxyUrl(normalized) : item;
        });
        continue;
      }
      out[key] = walk(raw as JsonLike);
    }
    return out;
  };

  return walk(value as JsonLike) as T;
}

class AsyncSemaphore {
  private readonly queue: Array<() => void> = [];
  private active = 0;

  constructor(private readonly max: number) {}

  async use<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) next();
  }
}

const imageFetchLimiter = new AsyncSemaphore(MAX_CONCURRENCY);
const inflight = new Map<string, Promise<{ status: number; contentType: string; body: Buffer }>>();

async function fetchImageWithRetry(url: string): Promise<{ status: number; contentType: string; body: Buffer }> {
  const candidateUrls = buildGoogleImageCandidates(url);

  for (const candidateUrl of candidateUrls) {
  let attempt = 0;
  while (true) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const resp = await fetch(candidateUrl, {
        headers: {
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
          'User-Agent': 'Mozilla/5.0 (compatible; MusicAppImageProxy/1.0)',
          Referer: 'https://music.youtube.com/',
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (resp.ok) {
        const arr = await resp.arrayBuffer();
        const contentType = resp.headers.get('content-type') ?? 'image/jpeg';
        return { status: 200, contentType, body: Buffer.from(arr) };
      }

      if ((resp.status === 429 || resp.status >= 500) && attempt < MAX_RETRIES) {
        attempt += 1;
        const delay = Math.min(400 * 2 ** attempt, 3000);
        await sleep(delay);
        continue;
      }

      return {
        status: resp.status,
        contentType: 'text/plain; charset=utf-8',
        body: Buffer.from('Image fetch failed'),
      };
    } catch {
      if (attempt < MAX_RETRIES) {
        attempt += 1;
        const delay = Math.min(400 * 2 ** attempt, 3000);
        await sleep(delay);
        continue;
      }
      return { status: 502, contentType: 'text/plain; charset=utf-8', body: Buffer.from('Image fetch failed') };
    }
  }
  }
  return { status: 502, contentType: 'text/plain; charset=utf-8', body: Buffer.from('Image fetch failed') };
}

export async function getProxiedImage(url: string): Promise<{ status: number; contentType: string; body: Buffer }> {
  const key = `img:proxy:v1:${url}`;
  const redis = getRedis();
  try {
    const cached = await redis.get(key);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { contentType: string; base64: string };
        if (typeof parsed.contentType === 'string' && typeof parsed.base64 === 'string') {
          return { status: 200, contentType: parsed.contentType, body: Buffer.from(parsed.base64, 'base64') };
        }
      } catch {
        // Cache corruption is non-fatal.
      }
    }
  } catch {
    // Redis failures should not break image proxying.
  }

  const pending = inflight.get(url);
  if (pending) {
    return pending;
  }

  const task = imageFetchLimiter.use(async () => {
    const fetched = await fetchImageWithRetry(url);
    if (fetched.status === 200) {
      try {
        const payload = JSON.stringify({ contentType: fetched.contentType, base64: fetched.body.toString('base64') });
        await redis.set(key, payload, 'EX', IMAGE_CACHE_TTL_SEC);
      } catch {
        // Redis failures should not break image proxying.
      }
    }
    return fetched;
  });
  inflight.set(url, task);
  try {
    return await task;
  } finally {
    inflight.delete(url);
  }
}
