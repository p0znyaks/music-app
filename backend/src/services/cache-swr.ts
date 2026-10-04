import { createLogger } from "../logger";
import { getRedis } from "./redis";

export interface CacheEnvelope<T> {
  v: 1;
  data: T;
  savedAt: number;
}

const log = createLogger("cache-swr");

/**
 * Last value that loaded successfully, kept in memory after its Redis entry
 * expires.
 *
 * YouTube fails in short bursts, and a user should never see an error page for
 * a screen that rendered a minute ago. Redis is the cache of record but its TTL
 * is finite, so this backup is what lasts long enough to cover an outage.
 */
const lastKnownGood = new Map<string, { data: unknown; savedAt: number }>();
const LAST_KNOWN_GOOD_LIMIT = 500;

function rememberGood<T>(key: string, data: T): void {
  if (lastKnownGood.size >= LAST_KNOWN_GOOD_LIMIT && !lastKnownGood.has(key)) {
    // Map preserves insertion order, so this drops the oldest entry.
    const oldest = lastKnownGood.keys().next();
    if (!oldest.done) {
      lastKnownGood.delete(oldest.value);
    }
  }
  lastKnownGood.set(key, { data, savedAt: Date.now() });
}

/** Drops the backup, e.g. after the user edits what the entry describes. */
export function forgetLastKnownGood(key: string): void {
  lastKnownGood.delete(key);
}

export function stringifyEnvelope<T>(data: T): string {
  const env: CacheEnvelope<T> = { v: 1, data, savedAt: Date.now() };
  return JSON.stringify(env);
}

function parseEnvelope<T>(raw: string): CacheEnvelope<T> | null {
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") {
      return null;
    }
    const rec = o as Record<string, unknown>;
    if (rec.v !== 1 || !("data" in rec) || typeof rec.savedAt !== "number") {
      return null;
    }
    return o as CacheEnvelope<T>;
  } catch {
    return null;
  }
}

/** Portion of a key's lifetime after which reads start refreshing in the background. */
const SOFT_TTL_RATIO = 0.6;

/**
 * Age at which an entry becomes "stale enough to refresh behind the response".
 *
 * Tying it to the entry's own TTL matters: a flat 30 minutes meant a 24-hour
 * search result was re-fetched from YouTube on every read after half an hour,
 * which is exactly the upstream traffic the cache exists to avoid. Callers can
 * still pass an explicit value for entries whose freshness matters.
 */
function softTtlFor(ttlSec: number, overrideMs: number | undefined): number {
  if (overrideMs !== undefined) {
    return overrideMs;
  }
  const raw = process.env.REDIS_SWR_SOFT_MS;
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  return Math.max(60_000, Math.floor(ttlSec * 1000 * SOFT_TTL_RATIO));
}

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
  const soft = softTtlFor(ttlSec, softTtlMs);
  const cachedRaw = await redis.get(key);
  if (cachedRaw) {
    const env = parseEnvelope<T>(cachedRaw);
    if (env) {
      rememberGood(key, env.data);
      const age = Date.now() - env.savedAt;
      if (age > soft) {
        const existing = inflightRefresh.get(key);
        if (!existing) {
          const p = (async () => {
            try {
              const data = await loader();
              await redis.set(key, stringifyEnvelope(data), "EX", ttlSec);
            } catch (e) {
              // The cached value stays as it is, so the next read still serves it.
              log.warn(`background refresh failed for ${key}:`, e);
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

async function runOnce<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
  inflight: Map<string, Promise<T>>,
): Promise<T> {
  const running = inflight.get(key);
  if (running) {
    return running;
  }
  const redis = getRedis();
  const req = loader()
    .then(async (data) => {
      await redis.set(key, stringifyEnvelope(data), "EX", ttlSec);
      rememberGood(key, data);
      return data;
    })
    .catch((err) => {
      // The upstream is down. Serving the last value that worked keeps the
      // user's screen populated instead of turning a hiccup into an error.
      const backup = lastKnownGood.get(key);
      if (backup) {
        log.warn(`serving last known good for ${key}:`, err);
        return backup.data as T;
      }
      throw err;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, req);
  return req;
}
