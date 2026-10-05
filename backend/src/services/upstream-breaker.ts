import { createLogger } from '../logger';
import { envInt } from '../env';

/**
 * Tracks whether the fast InnerTube path is currently usable.
 *
 * Its only job is to stop the search path from re-paying the InnerTube deadline
 * on every single request while YouTube is having a bad minute. It never
 * produces a "no results" answer: when open, callers skip straight to the
 * slower yt-dlp path so the user still gets songs, they just arrive later.
 */
export class UpstreamBreaker {
  private consecutiveFailures = 0;
  private openedAt = 0;
  private readonly name: string;

  private readonly failureThreshold: number;
  private readonly openMs: number;

  constructor(name: string, failureThreshold: number, openMs: number) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.openMs = openMs;
  }

  /** True while the fast path should be skipped entirely. */
  isOpen(): boolean {
    if (this.openedAt === 0) {
      return false;
    }
    if (Date.now() - this.openedAt < this.openMs) {
      return true;
    }
    // Cooldown elapsed: allow one probe through to see if the upstream healed.
    this.openedAt = 0;
    this.consecutiveFailures = 0;
    return false;
  }

  onSuccess(): void {
    if (this.consecutiveFailures !== 0 || this.openedAt !== 0) {
      this.consecutiveFailures = 0;
      this.openedAt = 0;
    }
  }

  onFailure(reason: string): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      if (this.openedAt === 0) {
        log.warn(`upstream "${this.name}" failing (${reason}); bypassing for ${this.openMs}ms`);
      }
      this.openedAt = Date.now();
    }
  }

  get state(): string {
    return this.openedAt === 0 ? 'closed' : 'open';
  }

  get failures(): number {
    return this.consecutiveFailures;
  }
}

const log = createLogger('breaker');

export const innertubeSearchBreaker = new UpstreamBreaker(
  'innertube-search',
  envInt('INNERTUBE_BREAKER_FAILURES', 4),
  envInt('INNERTUBE_BREAKER_OPEN_MS', 45000),
);

export const innertubeStreamBreaker = new UpstreamBreaker(
  'innertube-stream',
  envInt('INNERTUBE_BREAKER_FAILURES', 4),
  envInt('INNERTUBE_BREAKER_OPEN_MS', 45000),
);
