/**
 * Read a positive integer from the environment.
 *
 * Returns the fallback for missing, unparsable or non-positive values, so a
 * typo in a .env file degrades to a working default instead of a runtime error.
 */
export function envInt(name: string, fallback: number): number {
  return readInt(name, fallback, 1);
}

/**
 * Same as {@link envInt} but also accepts 0, for switches where zero is a
 * meaningful value (e.g. PYTHON_WORKERS=0 disables the pool entirely).
 */
export function envIntOrZero(name: string, fallback: number): number {
  return readInt(name, fallback, 0);
}

function readInt(name: string, fallback: number, min: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

/**
 * Counting semaphore that caps how many tasks run at once, queueing the rest.
 *
 * Used to keep outbound fan-out (upstream API calls, image fetches) within a
 * limit the remote service tolerates.
 */
export class AsyncSemaphore {
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
    if (next) {
      next();
    }
  }
}
