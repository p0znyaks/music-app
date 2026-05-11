import { randomUUID } from 'crypto';
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { ytdlpRateLimiter } from './ytdlp-rate-limiter';

export type PythonWorkerAction =
  | 'ping'
  | 'search_albums'
  | 'search_artists'
  | 'search_tracks'
  | 'get_album'
  | 'get_artist'
  | 'get_watch_playlist_radio'
  | 'get_song'
  | 'ytdlp_flat'
  | 'ytdlp_flat_rows'
  | 'search_bundle_stream'
  | 'reco_radio_batch'
  | 'reco_albums_batch';

interface PoolResponseOk {
  id: string;
  ok: true;
  data: unknown;
  seq?: number;
  stream?: boolean;
  done?: boolean;
}

interface PoolResponseErr {
  id: string;
  ok: false;
  error: string;
  trace?: string;
}

type PoolResponse = PoolResponseOk | PoolResponseErr;

type Pending = {
  onPartial?: (chunk: unknown) => void;
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  stream: boolean;
};

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function workerScriptPath(): string {
  return path.join(process.cwd(), 'scripts', 'ytmusic_worker.py');
}

class PythonWorkerSlot {
  private child: ChildProcess | null = null;
  private stdoutBuf = '';
  private readonly pendingById = new Map<string, Pending>();
  private inflightCount = 0;

  constructor(private readonly scriptPath: string) {}

  getInflight(): number {
    return this.inflightCount;
  }

  private spawnChild(): ChildProcess {
    const child = spawn('python3', [this.scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      if (process.env.PYTHON_WORKER_LOG === '1') {
        process.stderr.write(chunk);
      }
    });
    child.on('error', (err) => {
      console.error('[python-pool] worker spawn error:', err);
    });
    child.on('close', (code) => {
      if (this.child === child) {
        this.child = null;
      }
      if (code !== 0 && code !== null) {
        console.warn(`[python-pool] worker exited code=${code}`);
      }
      this.rejectAllPending(new Error(`python worker closed (code=${code})`));
    });
    const stdout = child.stdout;
    if (stdout) {
      stdout.setEncoding('utf8');
      stdout.on('data', (chunk: string) => this.onStdoutData(chunk));
    }
    return child;
  }

  private ensureChild(): ChildProcess {
    if (this.child && !this.child.killed) {
      return this.child;
    }
    this.stdoutBuf = '';
    this.child = this.spawnChild();
    return this.child;
  }

  private rejectAllPending(err: Error): void {
    for (const [, p] of this.pendingById) {
      clearTimeout(p.timeout);
      p.reject(err);
    }
    this.pendingById.clear();
    this.inflightCount = 0;
  }

  private onStdoutData(chunk: string): void {
    this.stdoutBuf += chunk;
    for (;;) {
      const nl = this.stdoutBuf.indexOf('\n');
      if (nl < 0) {
        break;
      }
      const line = this.stdoutBuf.slice(0, nl).trim();
      this.stdoutBuf = this.stdoutBuf.slice(nl + 1);
      if (!line) {
        continue;
      }
      let parsed: PoolResponse;
      try {
        parsed = JSON.parse(line) as PoolResponse;
      } catch {
        continue;
      }
      const id = parsed.id;
      if (!id || typeof id !== 'string') {
        continue;
      }
      const pending = this.pendingById.get(id);
      if (!pending) {
        continue;
      }

      if (!parsed.ok) {
        clearTimeout(pending.timeout);
        this.pendingById.delete(id);
        this.inflightCount = Math.max(0, this.inflightCount - 1);
        const err = parsed as PoolResponseErr;
        const msg = err.trace ? `${err.error}\n${err.trace}` : err.error;
        pending.reject(new Error(msg || 'python worker error'));
        continue;
      }

      const ok = parsed as PoolResponseOk;
      if (ok.stream) {
        pending.onPartial?.(ok.data);
        if (ok.done) {
          clearTimeout(pending.timeout);
          this.pendingById.delete(id);
          this.inflightCount = Math.max(0, this.inflightCount - 1);
          pending.resolve(ok.data);
        }
        continue;
      }

      clearTimeout(pending.timeout);
      this.pendingById.delete(id);
      this.inflightCount = Math.max(0, this.inflightCount - 1);
      pending.resolve(ok.data);
    }
  }

  async call<T>(action: PythonWorkerAction, args: Record<string, unknown> = {}): Promise<T> {
    const operation = `python:${action}`;
    await ytdlpRateLimiter.enter(operation);
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = randomUUID();
      const payload = `${JSON.stringify({ id, action, args })}\n`;
      try {
        const child = this.ensureChild();
        const result = await this.writeAndWaitResponse<T>(child, id, payload, false);
        await ytdlpRateLimiter.recordSuccess(operation);
        return result;
      } catch (e) {
        lastErr = e;
        this.killChild();
        this.stdoutBuf = '';
        const msg = (e as Error)?.message?.toLowerCase() ?? '';
        if (msg.includes('429') || msg.includes('too many requests')) {
          await ytdlpRateLimiter.record429(operation);
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  async callStream(action: PythonWorkerAction, args: Record<string, unknown>, onPartial: (chunk: unknown) => void): Promise<void> {
    const operation = `python:${action}`;
    await ytdlpRateLimiter.enter(operation);
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = randomUUID();
      const payload = `${JSON.stringify({ id, action, args })}\n`;
      try {
        const child = this.ensureChild();
        await this.writeAndWaitResponse<unknown>(child, id, payload, true, onPartial);
        await ytdlpRateLimiter.recordSuccess(operation);
        return;
      } catch (e) {
        lastErr = e;
        this.killChild();
        this.stdoutBuf = '';
        const msg = (e as Error)?.message?.toLowerCase() ?? '';
        if (msg.includes('429') || msg.includes('too many requests')) {
          await ytdlpRateLimiter.record429(operation);
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  private killChild(): void {
    if (this.child && !this.child.killed) {
      try {
        this.child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    }
    this.child = null;
  }

  private writeAndWaitResponse<T>(
    child: ChildProcess,
    expectedId: string,
    payload: string,
    stream: boolean,
    onPartial?: (chunk: unknown) => void,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const stdin = child.stdin;
      if (!stdin) {
        reject(new Error('python worker: missing stdin'));
        return;
      }

      const timeout = setTimeout(() => {
        this.pendingById.delete(expectedId);
        this.inflightCount = Math.max(0, this.inflightCount - 1);
        this.killChild();
        this.stdoutBuf = '';
        reject(new Error('python worker: timeout'));
      }, 120_000);

      const pending: Pending = {
        stream,
        onPartial,
        resolve: (v: unknown) => {
          clearTimeout(timeout);
          resolve(v as T);
        },
        reject: (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        },
        timeout,
      };

      this.pendingById.set(expectedId, pending);
      this.inflightCount += 1;

      try {
        const ok = stdin.write(payload);
        if (!ok) {
          stdin.once('drain', () => undefined);
        }
      } catch (e) {
        this.pendingById.delete(expectedId);
        this.inflightCount = Math.max(0, this.inflightCount - 1);
        clearTimeout(timeout);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }
}

let globalPool: PythonPool | null = null;

export class PythonPool {
  private readonly slots: PythonWorkerSlot[];

  constructor(count: number, scriptPath: string) {
    this.slots = Array.from({ length: count }, () => new PythonWorkerSlot(scriptPath));
  }

  private pickSlot(): PythonWorkerSlot {
    let best = this.slots[0]!;
    let bestN = best.getInflight();
    for (const s of this.slots) {
      const n = s.getInflight();
      if (n < bestN) {
        best = s;
        bestN = n;
      }
    }
    return best;
  }

  async call<T>(action: PythonWorkerAction, args: Record<string, unknown> = {}): Promise<T> {
    const slot = this.pickSlot();
    return slot.call<T>(action, args);
  }

  async callStream(action: PythonWorkerAction, args: Record<string, unknown>, onPartial: (chunk: unknown) => void): Promise<void> {
    const slot = this.pickSlot();
    return slot.callStream(action, args, onPartial);
  }

  async pingAll(): Promise<void> {
    await Promise.all(this.slots.map((s) => s.call<string>('ping', {})));
  }
}

export function getPythonPool(): PythonPool | null {
  return globalPool;
}

export async function startPythonPool(): Promise<boolean> {
  const n = envInt('PYTHON_WORKERS', 1);
  if (n <= 0) {
    globalPool = null;
    console.log('[python-pool] disabled (PYTHON_WORKERS=0)');
    return false;
  }
  try {
    const scriptPath = workerScriptPath();
    globalPool = new PythonPool(n, scriptPath);
    await globalPool.pingAll();
    console.log(`[python-pool] started with ${n} workers`);
    return true;
  } catch (e) {
    console.error('[python-pool] failed to start:', e);
    globalPool = null;
    return false;
  }
}

export function stopPythonPool(): void {
  globalPool = null;
}
