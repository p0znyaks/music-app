import { createLogger } from "../logger";
import { envInt } from "../env";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { Transform } from "stream";

const CACHE_DIR = process.env.AUDIO_CACHE_DIR?.trim() || "/app/audio_cache";

/** Total size budget for the on-disk audio cache. */
const MAX_BYTES = envInt("AUDIO_CACHE_MAX_BYTES", 1024 * 1024 * 1024);

/** Files older than this are evicted first (access time based). */
const MAX_AGE_MS = envInt("AUDIO_CACHE_MAX_AGE_MS", 7 * 24 * 60 * 60 * 1000);

/** Truncated downloads below this are treated as failed and removed. */
const MIN_VALID_BYTES = 64 * 1024;

const inflightWrites = new Map<string, Promise<void>>();

function isValidTrackId(trackId: string): boolean {
  return /^[A-Za-z0-9_-]{6,20}$/.test(trackId);
}

function audioCachePath(trackId: string): string {
  return path.join(CACHE_DIR, `${trackId}.m4a`);
}

function partialPath(trackId: string): string {
  return path.join(CACHE_DIR, `${trackId}.part`);
}

/**
 * Evict least-recently-used files until the cache fits into the byte budget.
 * Runs at most once per minute to keep it off the hot path.
 */
let lastSweep = 0;
async function sweep(): Promise<void> {
  const now = Date.now();
  if (now - lastSweep < 60_000) {
    return;
  }
  lastSweep = now;

  let entries: Array<{
    path: string;
    size: number;
    atimeMs: number;
    mtimeMs: number;
  }>;
  let dirents: string[] = [];
  try {
    dirents = await fsp.readdir(CACHE_DIR);
  } catch {
    return;
  }

  // Temporary downloads from interrupted runs are pure garbage: drop them.
  const junk = dirents.filter(
    (name) =>
      name.endsWith(".part") || name.endsWith(".dl") || name.endsWith(".ytdl"),
  );
  await Promise.all(
    junk.map((name) =>
      fsp.unlink(path.join(CACHE_DIR, name)).catch(() => undefined),
    ),
  );
  try {
    const statted = await Promise.all(
      dirents
        .filter((name) => name.endsWith(".m4a"))
        .map(
          async (
            name,
          ): Promise<{
            path: string;
            size: number;
            atimeMs: number;
            mtimeMs: number;
          } | null> => {
            const full = path.join(CACHE_DIR, name);
            try {
              const st = await fsp.stat(full);
              return {
                path: full,
                size: st.size,
                atimeMs: st.atimeMs,
                mtimeMs: st.mtimeMs,
              };
            } catch {
              return null;
            }
          },
        ),
    );
    entries = statted.filter(
      (
        x,
      ): x is {
        path: string;
        size: number;
        atimeMs: number;
        mtimeMs: number;
      } => x !== null,
    );
  } catch {
    return;
  }

  let total = entries.reduce((sum, e) => sum + e.size, 0);
  if (total <= MAX_BYTES) {
    return;
  }

  // Oldest access first — LRU eviction.
  entries.sort((a, b) => a.atimeMs - b.atimeMs);
  for (const entry of entries) {
    if (total <= MAX_BYTES) {
      break;
    }
    if (now - Math.max(entry.atimeMs, entry.mtimeMs) < MAX_AGE_MS) {
      continue;
    }
    try {
      await fsp.unlink(entry.path);
      total -= entry.size;
    } catch {
      /* already gone */
    }
  }
}

const log = createLogger("audio-cache");

export async function getCachedAudio(trackId: string): Promise<string | null> {
  if (!isValidTrackId(trackId)) {
    return null;
  }
  const full = audioCachePath(trackId);
  try {
    const st = await fsp.stat(full);
    if (st.size < MIN_VALID_BYTES) {
      return null;
    }
    // Touch so LRU keeps popular tracks.
    void fsp.utimes(full, new Date(), new Date()).catch(() => undefined);
    void sweep();
    return full;
  } catch {
    return null;
  }
}

/**
 * A writable sink that mirrors an upstream response to disk while the same
 * bytes stream to the client, so the next play of the track is served locally.
 *
 * The file is written under a `.part` name and only promoted to `.m4a` once
 * the upstream response completed without error. A client that aborts early, or
 * an upstream that dies mid-transfer, leaves the partial file behind and it is
 * removed, so a truncated download can never be served as if it were complete.
 */
export class AudioCacheWriter {
  private stream: fs.WriteStream | null = null;
  private bytes = 0;
  private failed = false;
  private readonly done: Promise<void>;

  private constructor(trackId: string) {
    const target = partialPath(trackId);
    const finalPath = audioCachePath(trackId);
    // The cache directory is a mounted volume and may be empty on a fresh start.
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    this.stream = fs.createWriteStream(target);

    this.done = new Promise<void>((resolve) => {
      const cleanup = (promote: boolean) => {
        const current = this.stream;
        this.stream = null;
        if (!current) {
          resolve();
          return;
        }
        const discard = () => {
          void fsp.unlink(target).catch(() => undefined);
          resolve();
        };
        // end() is a no-op on an already destroyed stream and its callback
        // never runs, so a destroyed handle has to be cleaned up directly.
        if (current.destroyed) {
          discard();
          return;
        }
        current.end(() => {
          // Too small to be a real track: treat it as a failed transfer.
          if (!promote || this.failed || this.bytes < MIN_VALID_BYTES) {
            discard();
            return;
          }
          void fsp
            .rm(finalPath, { force: true })
            .then(() => fsp.rename(target, finalPath))
            .then(() => {
              void sweep();
            })
            .catch((err) => {
              log.warn("promote failed", trackId, err);
              discard();
            })
            .finally(resolve);
        });
      };

      const fileStream = this.stream;
      if (!fileStream) {
        resolve();
        return;
      }
      fileStream.on("error", (err) => {
        this.failed = true;
        log.warn("write failed", trackId, err);
        cleanup(false);
      });
      fileStream.on("finish", () => cleanup(true));
      // destroy() (abort, client gone) emits 'close' without 'finish', and
      // that is exactly the case where the file must not be promoted.
      fileStream.on("close", () => cleanup(false));
    });
  }

  /**
   * Discard an in-flight download. Safe to call more than once and after the
   * transfer already completed, in which case it does nothing.
   */
  abort(): Promise<void> {
    this.failed = true;
    // Destroying the sink unpipes it but leaves the file handle open, so the
    // stream has to be closed here - otherwise 'finish' never fires and the
    // partial file is never removed.
    this.stream?.destroy();
    return this.done;
  }

  /**
   * Start mirroring. Returns a sink to wire into the pipeline, or null when the
   * track is not cacheable or another writer already owns it.
   */
  static start(trackId: string): {
    sink: Transform;
    complete: Promise<void>;
    abort: () => Promise<void>;
  } | null {
    if (!isValidTrackId(trackId) || inflightWrites.has(trackId)) {
      return null;
    }
    const writer = new AudioCacheWriter(trackId);
    const sink = new Transform({
      transform(chunk, _enc, cb) {
        writer.bytes += chunk.length;
        cb(null, chunk);
      },
    });
    sink.on("error", () => {
      writer.failed = true;
    });
    const fileStream = writer.stream;
    if (!fileStream) {
      return null;
    }
    sink.pipe(fileStream);

    inflightWrites.set(
      trackId,
      writer.done
        .catch(() => undefined)
        .finally(() => {
          inflightWrites.delete(trackId);
        }),
    );
    return { sink, complete: writer.done, abort: () => writer.abort() };
  }
}
