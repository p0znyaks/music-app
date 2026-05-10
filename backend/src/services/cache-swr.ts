import { getRedis } from './redis';

export interface CacheEnvelope<T> {
  v: 1;
  data: T;
  savedAt: number;
}

export function stringifyEnvelope<T>(data: T): string {
  const env: CacheEnvelope<T> = { v: 1, data, savedAt: Date.now() };
  return JSON.stringify(env);
}

export function parseEnvelope<T>(raw: string): CacheEnvelope<T> | null {
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object') {
      return null;
    }
    const rec = o as Record<string, unknown>;
    if (rec.v !== 1 || !('data' in rec) || typeof rec.savedAt !== 'number') {
      return null;
    }
    return o as CacheEnvelope<T>;
  } catch {
    return null;
  }
}

const defaultSoftMs = (): number => {
  const raw = process.env.REDIS_SWR_SOFT_MS;
  if (!raw) {
    return 30 * 60 * 1000;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 30 * 60 * 1000;
};

/**
 * Redis GET with envelope + stale-while-revalidate: returns data immediately when present,
 * optionally kicks a background refresh when entry is older than softTtlMs.
 */
export async function redisGetSWR<T>(
  key: string,
  ttlSec: number,
  softTtlMs: number | undefined,
  loader: () => Promise<T>,
  inflight: Map<string, Promise<T>>,
  inflightRefresh: Map<string, Promise<void>>,
): Promise<T> {
  const redis = getRedis();
  const soft = softTtlMs ?? defaultSoftMs();
  const cachedRaw = await redis.get(key);
  if (cachedRaw) {
    const env = parseEnvelope<T>(cachedRaw);
    if (env) {
      const age = Date.now() - env.savedAt;
      if (age > soft) {
        const existing = inflightRefresh.get(key);
        if (!existing) {
          const p = (async () => {
            try {
              const data = await loader();
              await redis.set(key, stringifyEnvelope(data), 'EX', ttlSec);
            } catch (e) {
              console.warn(`[cache-swr] background refresh failed for ${key}:`, e);
            }
          })().finally(() => {
            inflightRefresh.delete(key);
          });
          inflightRefresh.set(key, p);
        }
      }
      return env.data;
    }
  }

  return runOnce(key, ttlSec, loader, inflight);
}

async function runOnce<T>(key: string, ttlSec: number, loader: () => Promise<T>, inflight: Map<string, Promise<T>>): Promise<T> {
  const running = inflight.get(key);
  if (running) {
    return running;
  }
  const redis = getRedis();
  const req = loader()
    .then(async (data) => {
      await redis.set(key, stringifyEnvelope(data), 'EX', ttlSec);
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, req);
  return req;
}
