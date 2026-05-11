import { getRedis } from './redis';

interface RateLimitState {
  readonly until: number;
  readonly consecutive429s: number;
}

function nowMs(): number {
  return Date.now();
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const YTDLP_RATE_LIMIT_TTL_SEC = envInt('YTDLP_RATE_LIMIT_TTL_SEC', 60);

function stateKey(operation: string): string {
  return `ytdlp:ratelimit:${operation}`;
}

export class YtdlpRateLimiter {
  private readonly cooldownMs: number;
  private readonly maxConsecutive429: number;

  constructor(cooldownMs = 30_000, maxConsecutive429 = 3) {
    this.cooldownMs = cooldownMs;
    this.maxConsecutive429 = maxConsecutive429;
  }

  private async loadState(operation: string): Promise<RateLimitState | null> {
    const redis = getRedis();
    const key = stateKey(operation);
    const raw = await redis.get(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as RateLimitState;
      return parsed;
    } catch {
      return null;
    }
  }

  private async saveState(operation: string, state: RateLimitState): Promise<void> {
    const redis = getRedis();
    const key = stateKey(operation);
    const ttl = Math.ceil((state.until - nowMs()) / 1000);
    if (ttl > 0) {
      await redis.set(key, JSON.stringify(state), 'EX', Math.max(ttl, 1));
    }
  }

  private async clearState(operation: string): Promise<void> {
    const redis = getRedis();
    await redis.del(stateKey(operation));
  }

  private isBlocked(state: RateLimitState): boolean {
    return nowMs() < state.until;
  }

  private computeBackoff(state: RateLimitState): number {
    const base = this.cooldownMs;
    const extra = Math.pow(2, state.consecutive429s - 1) * base;
    return Math.min(base + extra, 300_000);
  }

  async enter(operation: string): Promise<void> {
    const state = await this.loadState(operation);
    if (state && this.isBlocked(state)) {
      const remainingMs = state.until - nowMs();
      const backoff = this.computeBackoff(state);
      throw new YtdlpRateLimitError(
        `Rate limited for operation "${operation}". Retry after ${Math.ceil(remainingMs / 1000)}s (backoff: ${backoff}ms, consecutive 429s: ${state.consecutive429s})`,
        remainingMs,
      );
    }
  }

  async record429(operation: string): Promise<void> {
    const existing = await this.loadState(operation);
    const consecutive429s = (existing?.consecutive429s ?? 0) + 1;
    const backoff = this.computeBackoff({ until: 0, consecutive429s });
    const until = nowMs() + backoff;

    const newState: RateLimitState = { until, consecutive429s };
    await this.saveState(operation, newState);

    console.warn(
      `[ytdlp:ratelimit] 429 recorded for "${operation}". consecutive429s=${consecutive429s}, backoff=${backoff}ms, until=${new Date(until).toISOString()}`,
    );
  }

  async recordSuccess(operation: string): Promise<void> {
    if (await this.loadState(operation)) {
      await this.clearState(operation);
    }
  }

  async reset(operation: string): Promise<void> {
    await this.clearState(operation);
  }
}

export class YtdlpRateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'YtdlpRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export const ytdlpRateLimiter = new YtdlpRateLimiter();