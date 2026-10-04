import { randomUUID } from "crypto";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { createLogger } from "../logger";
import { envIntOrZero } from "../env";

export type PythonWorkerAction =
  | "ping"
  | "search_albums"
  | "search_artists"
  | "search_songs"
  | "get_album"
  | "get_artist"
  | "get_watch_playlist_radio"
  | "get_song"
  | "get_player_stream"
  | "search_bundle"
  | "reco_radio_batch"
  | "reco_albums_batch";

/**
 * Per-action budget for a worker command.
 *
 * The worker answers on a single stdin/stdout pipe, so one stuck command also
 * stalls everything queued behind it in that slot. Every action therefore gets
 * a deadline close to what it can realistically need (InnerTube itself is
 * budgeted at 1.6s), and a slot whose command overruns is recycled instead of
 * being allowed to hold the queue for minutes.
 */
const DEFAULT_CMD_TIMEOUT_MS = 15_000;
const ACTION_TIMEOUT_MS: Partial<Record<PythonWorkerAction, number>> = {
  ping: 5_000,
  search_bundle: 12_000,
  search_songs: 12_000,
  search_albums: 12_000,
  search_artists: 12_000,
  get_song: 10_000,
  get_player_stream: 10_000,
  get_album: 10_000,
  get_artist: 12_000,
  get_watch_playlist_radio: 15_000,
  reco_radio_batch: 20_000,
  reco_albums_batch: 20_000,
};

function timeoutForAction(action: PythonWorkerAction): number {
  const override = envIntOrZero("PYTHON_CMD_TIMEOUT_MS", 0);
  if (override > 0) {
    return override;
  }
  return ACTION_TIMEOUT_MS[action] ?? DEFAULT_CMD_TIMEOUT_MS;
}

interface PoolResponseOk {
  id: string;
  ok: true;
  data: unknown;
}

interface PoolResponseErr {
  id: string;
  ok: false;
  error: string;
  trace?: string;
}

type PoolResponse = PoolResponseOk | PoolResponseErr;

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

function workerScriptPath(): string {
  return path.join(process.cwd(), "scripts", "ytmusic_worker.py");
}

class PythonWorkerSlot {
  private child: ChildProcess | null = null;
  private stdoutBuf = "";
  private readonly pendingById = new Map<string, Pending>();
  private inflightCount = 0;

  constructor(private readonly scriptPath: string) {}

  getInflight(): number {
    return this.inflightCount;
  }

  private spawnChild(): ChildProcess {
    const child = spawn("python3", [this.scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      if (process.env.PYTHON_WORKER_LOG === "1") {
        process.stderr.write(chunk);
      }
    });
    child.on("error", (err) => {
      log.error("worker spawn error:", err);
    });
    child.on("close", (code) => {
      if (this.child === child) {
        this.child = null;
      }
      if (code !== 0 && code !== null) {
        log.warn(`worker exited code=${code}`);
      }
      this.rejectAllPending(new Error(`python worker closed (code=${code})`));
    });
    const stdout = child.stdout;
    if (stdout) {
      stdout.setEncoding("utf8");
      stdout.on("data", (chunk: string) => this.onStdoutData(chunk));
    }
    return child;
  }

  private ensureChild(): ChildProcess {
    if (this.child && !this.child.killed) {
      return this.child;
    }
    this.stdoutBuf = "";
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
      const nl = this.stdoutBuf.indexOf("\n");
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
      if (!id || typeof id !== "string") {
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
        pending.reject(new Error(msg || "python worker error"));
        continue;
      }

      const ok = parsed as PoolResponseOk;
      clearTimeout(pending.timeout);
      this.pendingById.delete(id);
      this.inflightCount = Math.max(0, this.inflightCount - 1);
      pending.resolve(ok.data);
    }
  }

  async call<T>(
    action: PythonWorkerAction,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    // Retrying helps with a brief blip, but three full deadlines in a row would
    // let a stuck upstream hold the caller for minutes. The retry loop is
    // therefore bounded by one overall budget instead of three per-attempt ones.
    const budgetMs = timeoutForAction(action);
    const overallDeadline = Date.now() + budgetMs * 2;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const remaining = overallDeadline - Date.now();
      if (remaining <= 0) {
        break;
      }
      const id = randomUUID();
      const payload = `${JSON.stringify({ id, action, args })}\n`;
      try {
        const child = this.ensureChild();
        return await this.writeAndWaitResponse<T>(
          child,
          id,
          payload,
          action,
          remaining,
        );
      } catch (e) {
        lastErr = e;
        this.killChild();
        this.stdoutBuf = "";
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  private killChild(): void {
    if (this.child && !this.child.killed) {
      try {
        this.child.kill("SIGTERM");
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
    action: PythonWorkerAction,
    deadlineMs: number,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const stdin = child.stdin;
      if (!stdin) {
        reject(new Error("python worker: missing stdin"));
        return;
      }

      const budgetMs = deadlineMs;
      const timeout = setTimeout(() => {
        // A stuck command leaves the worker unable to answer anything queued
        // behind it, so this slot's other commands are failed right away
        // instead of each burning their own deadline.
        this.rejectAllPending(
          new Error(`python worker: ${action} exceeded ${budgetMs}ms`),
        );
        this.killChild();
        this.stdoutBuf = "";
      }, budgetMs);

      const pending: Pending = {
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
          stdin.once("drain", () => undefined);
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
    this.slots = Array.from(
      { length: count },
      () => new PythonWorkerSlot(scriptPath),
    );
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

  async call<T>(
    action: PythonWorkerAction,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    const slot = this.pickSlot();
    return slot.call<T>(action, args);
  }

  async pingAll(): Promise<void> {
    await Promise.all(this.slots.map((s) => s.call<string>("ping", {})));
  }
}

const log = createLogger("python-pool");

export function getPythonPool(): PythonPool | null {
  return globalPool;
}

export async function startPythonPool(): Promise<boolean> {
  const n = envIntOrZero("PYTHON_WORKERS", 2);
  if (n <= 0) {
    globalPool = null;
    log.info("disabled (PYTHON_WORKERS=0)");
    return false;
  }
  try {
    const scriptPath = workerScriptPath();
    globalPool = new PythonPool(n, scriptPath);
    await globalPool.pingAll();
    log.info(`started with ${n} workers`);
    return true;
  } catch (e) {
    log.error("failed to start:", e);
    globalPool = null;
    return false;
  }
}
